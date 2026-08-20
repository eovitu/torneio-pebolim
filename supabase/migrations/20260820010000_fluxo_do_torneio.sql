-- =============================================================================
-- torneio-pebolim — fluxo de criação e condução do torneio
--
-- Premissa do proprietário: o sistema GUARDA o estado das fases, mas quem
-- decide avançar é sempre uma ação explícita do administrador. Não existe
-- "todos os jogos acabaram, então gera o chaveamento": isso exigiria fixar
-- quantos avançam, como distribuir a chave e como desempatar — regras que não
-- estão definidas e que este código NÃO inventa (§2, §67).
--
-- Decisões esportivas aplicadas aqui, todas do proprietário:
--   - fase de grupos: todos contra todos em TURNO ÚNICO;
--   - mata-mata: o admin escolhe manualmente cada confronto;
--   - sorteio das duplas: feito no servidor e registrado em auditoria;
--   - elenco pode mudar com o torneio em andamento, mas fica rastreado.
-- =============================================================================

set search_path = public;

-- -----------------------------------------------------------------------------
-- 1. FASE ENCERRADA
--
-- Encerrar uma fase é um ato do administrador, não uma consequência automática
-- do último jogo terminar. `encerrada_em` registra quando isso aconteceu.
-- -----------------------------------------------------------------------------
alter table phases add column encerrada_em timestamptz;

-- -----------------------------------------------------------------------------
-- 2. ESTADOS DO TORNEIO
--
-- Guarda técnica sobre a coluna `status`: impede saltos incoerentes. A ordem é
-- linear, com uma única volta permitida — de AGUARDANDO_INICIO para
-- CONFIGURACAO, para o admin corrigir algo antes da primeira bola. Depois que
-- o torneio começou não se volta a configurar.
-- -----------------------------------------------------------------------------
create function guardar_transicao_torneio() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = old.status then return new; end if;

  if not (
       (old.status = 'CONFIGURACAO'      and new.status = 'AGUARDANDO_INICIO')
    or (old.status = 'AGUARDANDO_INICIO' and new.status in ('CONFIGURACAO','EM_ANDAMENTO'))
    or (old.status = 'EM_ANDAMENTO'      and new.status = 'ENCERRADO')
  ) then
    raise exception 'transição de torneio inválida: % → %', old.status, new.status;
  end if;

  perform registrar_auditoria('ALTERAR_STATUS_TORNEIO', 'tournaments', new.id, new.id,
                              jsonb_build_object('status', old.status),
                              jsonb_build_object('status', new.status), null);
  return new;
end $$;

create trigger trg_40_transicao_torneio
  before update of status on tournaments
  for each row execute function guardar_transicao_torneio();

-- -----------------------------------------------------------------------------
-- 3. PARTIDA SÓ COMEÇA COM O TORNEIO EM ANDAMENTO (§61)
--
-- Recria `iniciar_partida` acrescentando a checagem de estado do campeonato.
-- O resto do corpo é idêntico ao da migration inicial.
-- -----------------------------------------------------------------------------
create or replace function iniciar_partida(p_match_id uuid) returns matches
language plpgsql security definer set search_path = public as $$
declare m matches%rowtype; agora timestamptz := now(); st_torneio tournament_status;
begin
  select * into m from matches where id = p_match_id for update;
  if m.id is null then raise exception 'partida inexistente'; end if;
  if m.status <> 'SCHEDULED' then
    raise exception 'transição de partida inválida: % → LIVE', m.status;
  end if;

  select t.status into st_torneio from tournaments t where t.id = m.tournament_id;
  if st_torneio <> 'EM_ANDAMENTO' then
    raise exception 'o campeonato está em % — partidas só começam com ele em andamento', st_torneio;
  end if;

  if exists (select 1 from phases f where f.id = m.phase_id and f.encerrada_em is not null) then
    raise exception 'a fase desta partida já foi encerrada';
  end if;

  if not (is_admin(auth.uid()) or is_jogador_do_torneio(m.tournament_id, auth.uid())) then
    raise exception 'sem permissão para iniciar esta partida';
  end if;

  update matches set status = 'LIVE', started_at = agora,
         iniciada_por = auth.uid(), arbitro_user_id = auth.uid(), updated_at = agora
   where id = p_match_id returning * into m;

  insert into match_events (match_id, type, clock_ms, created_by)
  values (p_match_id, 'MATCH_STARTED', 0, auth.uid());
  return m;
end $$;

-- -----------------------------------------------------------------------------
-- 4. SORTEIO DAS EQUIPES
--
-- O sorteio roda no SERVIDOR e grava semente e resultado em auditoria. Um
-- sorteio feito no navegador não é auditável nem reproduzível: seria a palavra
-- de quem clicou contra a de quem reclamou. Com a semente registrada, o mesmo
-- sorteio pode ser refeito e conferido.
--
-- A função não decide NADA de esportivo: quantas equipes e quantos jogadores
-- por equipe vêm da configuração do torneio, definida pelo admin.
-- -----------------------------------------------------------------------------
create function sortear_equipes(
  p_tournament_id uuid,
  p_player_ids    uuid[],
  p_nomes_equipes text[] default null,
  p_seed          double precision default null
) returns table (team_id uuid, equipe text, player_id uuid, jogador text)
language plpgsql security definer set search_path = public as $$
declare
  t             tournaments%rowtype;
  total_exigido int;
  semente       double precision;
  embaralhados  uuid[];
  novo_time     uuid;
  nome_time     text;
  i             int;
  j             int;
  pos           int;
begin
  if not is_admin(auth.uid()) then
    raise exception 'somente administrador pode sortear as equipes';
  end if;

  select * into t from tournaments where id = p_tournament_id for update;
  if t.id is null then raise exception 'torneio inexistente'; end if;
  if t.status <> 'CONFIGURACAO' then
    raise exception 'o sorteio só acontece com o torneio em configuração (está em %)', t.status;
  end if;
  if exists (select 1 from teams where tournament_id = p_tournament_id) then
    raise exception 'este torneio já tem equipes formadas; remova-as antes de sortear de novo';
  end if;

  total_exigido := t.max_equipes * t.jogadores_por_equipe;
  if coalesce(array_length(p_player_ids, 1), 0) <> total_exigido then
    raise exception 'o sorteio precisa de % jogadores (% equipes × % por equipe), recebeu %',
      total_exigido, t.max_equipes, t.jogadores_por_equipe,
      coalesce(array_length(p_player_ids, 1), 0);
  end if;
  if (select count(distinct x) from unnest(p_player_ids) x) <> total_exigido then
    raise exception 'há jogadores repetidos na lista do sorteio';
  end if;
  if (select count(*) from players where id = any(p_player_ids)) <> total_exigido then
    raise exception 'algum jogador da lista não existe';
  end if;
  if p_nomes_equipes is not null
     and array_length(p_nomes_equipes, 1) <> t.max_equipes then
    raise exception 'informe % nomes de equipe ou nenhum', t.max_equipes;
  end if;

  -- Semente explícita permite refazer um sorteio para conferência; sem ela,
  -- vem do relógio. Em qualquer caso ela fica registrada na auditoria.
  semente := coalesce(p_seed,
                      (extract(microseconds from clock_timestamp())::numeric / 1000000)::double precision);
  perform setseed(semente);

  select array_agg(x order by random()) into embaralhados from unnest(p_player_ids) x;

  for i in 1 .. t.max_equipes loop
    nome_time := coalesce(p_nomes_equipes[i], 'Equipe ' || i);
    insert into teams (tournament_id, nome) values (p_tournament_id, nome_time)
      returning id into novo_time;

    for j in 1 .. t.jogadores_por_equipe loop
      pos := (i - 1) * t.jogadores_por_equipe + j;
      insert into team_players (team_id, player_id, tournament_id)
      values (novo_time, embaralhados[pos], p_tournament_id);
    end loop;
  end loop;

  perform registrar_auditoria(
    'SORTEAR_EQUIPES', 'teams', null, p_tournament_id, null,
    jsonb_build_object(
      'semente', semente,
      'ordem_sorteada', to_jsonb(embaralhados),
      'composicao', (
        select jsonb_agg(jsonb_build_object('equipe', e.nome,
                                            'jogadores', e.jogadores) order by e.nome)
          from (select tm.nome,
                       jsonb_agg(p.nome order by p.nome) as jogadores
                  from teams tm
                  join team_players tp on tp.team_id = tm.id
                  join players p on p.id = tp.player_id
                 where tm.tournament_id = p_tournament_id
                 group by tm.nome) e)),
    null);

  return query
    select tm.id, tm.nome, p.id, p.nome
      from teams tm
      join team_players tp on tp.team_id = tm.id
      join players p on p.id = tp.player_id
     where tm.tournament_id = p_tournament_id
     order by tm.nome, p.nome;
end $$;

-- -----------------------------------------------------------------------------
-- 5. PARTIDAS DA FASE DE GRUPOS — todos contra todos, turno único
--
-- Decisão do proprietário: turno único. Com N equipes saem N×(N−1)/2 jogos —
-- 6 jogos para 4 equipes. A ordem dos confrontos é determinística (pelo nome
-- da equipe), para que gerar duas vezes produza a mesma tabela.
-- -----------------------------------------------------------------------------
create function gerar_partidas_grupo(p_phase_id uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare f phases%rowtype; criadas int := 0; par record; sem_elenco text;
begin
  if not is_admin(auth.uid()) then
    raise exception 'somente administrador pode gerar as partidas';
  end if;

  select * into f from phases where id = p_phase_id for update;
  if f.id is null then raise exception 'fase inexistente'; end if;
  if f.kind <> 'GROUP' then
    raise exception 'esta fase é de mata-mata: os confrontos são definidos um a um';
  end if;
  if f.encerrada_em is not null then raise exception 'esta fase já foi encerrada'; end if;
  if exists (select 1 from matches where phase_id = p_phase_id) then
    raise exception 'esta fase já tem partidas geradas';
  end if;

  -- Sem elenco montado, `sincronizar_escalacao` cria partidas sem escalação e
  -- nenhum gol poderia ser registrado depois. Melhor barrar aqui.
  select string_agg(tm.nome, ', ' order by tm.nome) into sem_elenco
    from teams tm
   where tm.tournament_id = f.tournament_id
     and not exists (select 1 from team_players tp where tp.team_id = tm.id);
  if sem_elenco is not null then
    raise exception 'estas equipes ainda estão sem jogadores: %', sem_elenco;
  end if;

  if (select count(*) from teams where tournament_id = f.tournament_id) < 2 then
    raise exception 'são necessárias ao menos 2 equipes para gerar confrontos';
  end if;

  for par in
    select a.id as a_id, b.id as b_id,
           row_number() over (order by lower(a.nome), lower(b.nome)) as n
      from teams a
      join teams b
        on b.tournament_id = a.tournament_id
       and lower(a.nome) < lower(b.nome)
     where a.tournament_id = f.tournament_id
  loop
    insert into matches (tournament_id, phase_id, phase_kind, label, ordem, team_a_id, team_b_id)
    values (f.tournament_id, f.id, f.kind, '', par.n, par.a_id, par.b_id);
    criadas := criadas + 1;
  end loop;

  perform registrar_auditoria('GERAR_PARTIDAS_GRUPO', 'phases', f.id, f.tournament_id, null,
                              jsonb_build_object('partidas_criadas', criadas), null);
  return criadas;
end $$;

-- -----------------------------------------------------------------------------
-- 6. CONFRONTO DE MATA-MATA — um a um, escolhido pelo admin
--
-- Sem geração automática de chaveamento: não existe regra definida de quantos
-- avançam nem de como distribuir a chave. O sistema só verifica o que sabe
-- verificar — que as equipes são do torneio, que são distintas, e que a fase
-- anterior já foi encerrada.
-- -----------------------------------------------------------------------------
create function criar_partida_mata_mata(
  p_phase_id      uuid,
  p_team_a_id     uuid,
  p_team_b_id     uuid,
  p_agendada_para timestamptz default null
) returns matches
language plpgsql security definer set search_path = public as $$
declare f phases%rowtype; m matches%rowtype; anterior phases%rowtype; proxima int;
begin
  if not is_admin(auth.uid()) then
    raise exception 'somente administrador pode criar confrontos';
  end if;

  select * into f from phases where id = p_phase_id for update;
  if f.id is null then raise exception 'fase inexistente'; end if;
  if f.kind <> 'KNOCKOUT' then
    raise exception 'esta fase é de grupos: use a geração de todos contra todos';
  end if;
  if f.encerrada_em is not null then raise exception 'esta fase já foi encerrada'; end if;

  if p_team_a_id = p_team_b_id then
    raise exception 'uma equipe não pode enfrentar a si mesma';
  end if;
  if not exists (select 1 from teams where id = p_team_a_id and tournament_id = f.tournament_id)
     or not exists (select 1 from teams where id = p_team_b_id and tournament_id = f.tournament_id) then
    raise exception 'as duas equipes precisam ser deste torneio';
  end if;

  -- A fase imediatamente anterior precisa estar encerrada. Sem fase anterior
  -- (torneio que é só mata-mata), não há o que exigir.
  select * into anterior from phases
   where tournament_id = f.tournament_id and ordem < f.ordem
   order by ordem desc limit 1;
  if anterior.id is not null and anterior.encerrada_em is null then
    raise exception 'a fase "%" ainda não foi encerrada', anterior.nome;
  end if;

  select coalesce(max(ordem), 0) + 1 into proxima from matches where phase_id = p_phase_id;

  insert into matches (tournament_id, phase_id, phase_kind, label, ordem,
                       team_a_id, team_b_id, agendada_para)
  values (f.tournament_id, f.id, f.kind, '', proxima, p_team_a_id, p_team_b_id, p_agendada_para)
  returning * into m;

  perform registrar_auditoria('CRIAR_PARTIDA_MATA_MATA', 'matches', m.id, f.tournament_id,
                              null, to_jsonb(m), null);
  return m;
end $$;

-- -----------------------------------------------------------------------------
-- 7. ENCERRAR FASE
--
-- Ato explícito do administrador. Exige que nenhuma partida esteja pendente:
-- encerrar a fase de grupos com jogos por disputar congelaria a classificação
-- num estado incompleto. Isto é guarda de integridade, não critério esportivo
-- — o admin resolve as partidas pendentes e encerra quando quiser.
-- -----------------------------------------------------------------------------
create function encerrar_fase(p_phase_id uuid) returns phases
language plpgsql security definer set search_path = public as $$
declare f phases%rowtype; pendentes int;
begin
  if not is_admin(auth.uid()) then
    raise exception 'somente administrador pode encerrar uma fase';
  end if;

  select * into f from phases where id = p_phase_id for update;
  if f.id is null then raise exception 'fase inexistente'; end if;
  if f.encerrada_em is not null then raise exception 'esta fase já foi encerrada'; end if;

  select count(*) into pendentes from matches
   where phase_id = p_phase_id and status <> 'FINISHED';
  if pendentes > 0 then
    raise exception 'ainda há % partida(s) não encerrada(s) nesta fase', pendentes;
  end if;
  if not exists (select 1 from matches where phase_id = p_phase_id) then
    raise exception 'esta fase não tem partidas';
  end if;

  update phases set encerrada_em = now() where id = p_phase_id returning * into f;

  perform registrar_auditoria('ENCERRAR_FASE', 'phases', f.id, f.tournament_id, null,
                              jsonb_build_object('nome', f.nome, 'encerrada_em', f.encerrada_em),
                              null);
  return f;
end $$;

-- -----------------------------------------------------------------------------
-- 8. RASTRO DE MUDANÇA DE ELENCO
--
-- Trocar jogador de equipe com o torneio em andamento é permitido (lesão,
-- ausência), mas nunca silencioso: fica quem mudou, o quê e quando. Partidas
-- já disputadas não são afetadas — `sincronizar_escalacao` só mexe nas que
-- ainda estão SCHEDULED.
-- -----------------------------------------------------------------------------
create function auditar_elenco() returns trigger
language plpgsql security definer set search_path = public as $$
declare alvo record; st tournament_status; nome_jogador text; nome_equipe text;
begin
  alvo := coalesce(new, old);

  select t.status into st from tournaments t where t.id = alvo.tournament_id;
  if st = 'CONFIGURACAO' then return null; end if;  -- montagem inicial não é correção

  select nome into nome_jogador from players where id = alvo.player_id;
  select nome into nome_equipe  from teams   where id = alvo.team_id;

  perform registrar_auditoria(
    case tg_op when 'INSERT' then 'ADICIONAR_JOGADOR_EQUIPE'
               when 'DELETE' then 'REMOVER_JOGADOR_EQUIPE'
               else 'ALTERAR_JOGADOR_EQUIPE' end,
    'team_players', alvo.player_id, alvo.tournament_id,
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end,
    format('%s — %s', coalesce(nome_equipe, '?'), coalesce(nome_jogador, '?')));
  return null;
end $$;

create trigger trg_40_auditar_elenco
  after insert or update or delete on team_players
  for each row execute function auditar_elenco();

-- -----------------------------------------------------------------------------
-- 9. EXECUTE — mesma política da migration de hardening
-- -----------------------------------------------------------------------------
revoke execute on function guardar_transicao_torneio(), auditar_elenco()
  from public, anon, authenticated;

revoke execute on function
  sortear_equipes(uuid, uuid[], text[], double precision),
  gerar_partidas_grupo(uuid),
  criar_partida_mata_mata(uuid, uuid, uuid, timestamptz),
  encerrar_fase(uuid)
  from public, anon, authenticated;

grant execute on function
  sortear_equipes(uuid, uuid[], text[], double precision),
  gerar_partidas_grupo(uuid),
  criar_partida_mata_mata(uuid, uuid, uuid, timestamptz),
  encerrar_fase(uuid)
  to authenticated;
