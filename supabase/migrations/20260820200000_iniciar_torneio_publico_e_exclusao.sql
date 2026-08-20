-- =============================================================================
-- COMEÇAR O TORNEIO É PÚBLICO, COMO INICIAR PARTIDA
--
-- Decisão do proprietário (20/08/2026): assim como qualquer jogador do torneio
-- pode iniciar uma partida, qualquer participante pode COMEÇAR o torneio,
-- desde que haja ao menos duas pessoas. Não precisa ser administrador.
--
-- Antes, começar exigia três passos manuais e todos de admin: sortear as
-- equipes, criar a fase e gerar as partidas. Com duas pessoas querendo jogar
-- agora, isso é um muro. `iniciar_torneio` faz o caminho inteiro:
--
--   inscritos → equipes sorteadas → fase de grupos → partidas → EM_ANDAMENTO
--
-- Nada de regra esportiva é inventado aqui. A composição das equipes é a mesma
-- de `composicao_de_equipes` (espelho de `comporEquipes` no domínio) e os
-- confrontos são o mesmo todos-contra-todos que `gerar_partidas_grupo` já
-- fazia. O que muda é QUEM pode disparar e o fato de ser um passo só.
--
-- Para isso, a lógica de sortear e de gerar confrontos foi extraída para
-- funções internas SEM verificação de permissão. Quem verifica permissão é
-- quem chama: as RPCs de admin continuam exigindo admin, e `iniciar_torneio`
-- exige ser participante. Sem essa separação, `iniciar_torneio` chamaria
-- `sortear_equipes`, que checaria `is_admin(auth.uid())` e recusaria o jogador
-- comum mesmo dentro de uma função SECURITY DEFINER.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. INTERNAS — a mecânica, sem decidir quem pode
-- -----------------------------------------------------------------------------

create function formar_equipes_interno(
  p_tournament_id uuid,
  p_player_ids    uuid[] default null,
  p_nomes_equipes text[] default null,
  p_seed          double precision default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  t            tournaments%rowtype;
  ids          uuid[];
  total        int;
  comp         record;
  semente      double precision;
  embaralhados uuid[];
  novo_time    uuid;
  i            int;
  pos          int := 1;
  tamanho      int;
  j            int;
begin
  select * into t from tournaments where id = p_tournament_id for update;
  if t.id is null then raise exception 'torneio inexistente'; end if;
  if t.status <> 'CONFIGURACAO' then
    raise exception 'o sorteio só acontece com o torneio em configuração (está em %)', t.status;
  end if;
  if exists (select 1 from teams where tournament_id = p_tournament_id) then
    raise exception 'este torneio já tem equipes formadas; desfaça o sorteio antes de refazer';
  end if;

  if p_player_ids is null then
    select array_agg(tp.player_id) into ids
      from tournament_participants tp
     where tp.tournament_id = p_tournament_id;
  else
    ids := p_player_ids;
  end if;

  total := coalesce(array_length(ids, 1), 0);
  if total < 2 then
    raise exception 'são necessários ao menos 2 participantes para formar equipes, há %', total;
  end if;
  if (select count(distinct x) from unnest(ids) x) <> total then
    raise exception 'há jogadores repetidos na lista do sorteio';
  end if;
  if (select count(*) from players where id = any(ids)) <> total then
    raise exception 'algum jogador da lista não existe';
  end if;

  select * into comp from composicao_de_equipes(total);

  if p_nomes_equipes is not null
     and array_length(p_nomes_equipes, 1) <> comp.equipes then
    raise exception 'com % participantes formam-se % equipes; informe % nomes ou nenhum',
      total, comp.equipes, comp.equipes;
  end if;
  if p_seed is not null and (p_seed < -1 or p_seed > 1) then
    raise exception 'a semente precisa estar entre -1 e 1';
  end if;

  semente := coalesce(p_seed, random());
  perform setseed(semente);
  select array_agg(x order by random()) into embaralhados from unnest(ids) x;

  for i in 1 .. comp.equipes loop
    tamanho := case when i <= comp.duplas then 2 else 1 end;

    insert into teams (tournament_id, nome)
    values (p_tournament_id, coalesce(p_nomes_equipes[i], 'Equipe ' || i))
      returning id into novo_time;

    for j in 1 .. tamanho loop
      insert into team_players (team_id, player_id, tournament_id)
      values (novo_time, embaralhados[pos], p_tournament_id);
      pos := pos + 1;
    end loop;
  end loop;

  update tournaments
     set max_equipes          = comp.equipes,
         jogadores_por_equipe = case when comp.duplas > 0 then 2 else 1 end,
         updated_at           = now()
   where id = p_tournament_id;

  perform registrar_auditoria(
    p_acao          => 'SORTEAR_EQUIPES',
    p_entidade      => 'teams',
    p_entidade_id   => null,
    p_tournament_id => p_tournament_id,
    p_depois        => jsonb_build_object(
      'semente', semente,
      'participantes', total,
      'duplas', comp.duplas,
      'sozinhos', comp.solos,
      'ordem_sorteada', to_jsonb(embaralhados)));
end $$;

create function gerar_partidas_grupo_interno(p_phase_id uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare f phases%rowtype; criadas int := 0; par record; sem_elenco text;
begin
  select * into f from phases where id = p_phase_id for update;
  if f.id is null then raise exception 'fase inexistente'; end if;
  if f.kind <> 'GROUP' then
    raise exception 'esta fase é de mata-mata: os confrontos são definidos um a um';
  end if;
  if f.encerrada_em is not null then raise exception 'esta fase já foi encerrada'; end if;
  if exists (select 1 from matches where phase_id = p_phase_id) then
    raise exception 'esta fase já tem partidas geradas';
  end if;

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

  perform registrar_auditoria(
    p_acao          => 'GERAR_PARTIDAS_GRUPO',
    p_entidade      => 'phases',
    p_entidade_id   => f.id,
    p_tournament_id => f.tournament_id,
    p_depois        => jsonb_build_object('partidas_criadas', criadas));
  return criadas;
end $$;

-- As internas nunca entram na API: quem as expõe são as RPCs abaixo, cada uma
-- com a sua verificação de permissão (§47).
revoke execute on function formar_equipes_interno(uuid, uuid[], text[], double precision)
  from public, anon, authenticated;
revoke execute on function gerar_partidas_grupo_interno(uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. AS RPCs DE ADMIN passam a delegar
-- -----------------------------------------------------------------------------

create or replace function sortear_equipes(
  p_tournament_id uuid,
  p_player_ids    uuid[] default null,
  p_nomes_equipes text[] default null,
  p_seed          double precision default null
) returns table (team_id uuid, equipe text, player_id uuid, jogador text)
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin(auth.uid()) then
    raise exception 'somente administrador pode sortear as equipes';
  end if;

  perform formar_equipes_interno(p_tournament_id, p_player_ids, p_nomes_equipes, p_seed);

  return query
    select tm.id, tm.nome, p.id, p.nome
      from teams tm
      join team_players tp on tp.team_id = tm.id
      join players p on p.id = tp.player_id
     where tm.tournament_id = p_tournament_id
     order by tm.nome, p.nome;
end $$;

create or replace function gerar_partidas_grupo(p_phase_id uuid) returns integer
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin(auth.uid()) then
    raise exception 'somente administrador pode gerar as partidas';
  end if;
  return gerar_partidas_grupo_interno(p_phase_id);
end $$;

-- -----------------------------------------------------------------------------
-- 3. COMEÇAR O TORNEIO — qualquer participante
-- -----------------------------------------------------------------------------

/** A pessoa está inscrita neste torneio? Vale antes de existirem equipes. */
create function is_participante_do_torneio(p_tournament_id uuid, uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from tournament_participants tp
      join players p on p.id = tp.player_id
     where tp.tournament_id = p_tournament_id and p.profile_id = uid);
$$;

revoke execute on function is_participante_do_torneio(uuid, uuid) from public, anon;
grant  execute on function is_participante_do_torneio(uuid, uuid) to authenticated;

create function iniciar_torneio(p_tournament_id uuid) returns tournaments
language plpgsql security definer set search_path = public as $$
declare
  t        tournaments%rowtype;
  uid      uuid := auth.uid();
  v_fase   uuid;
  v_inscritos int;
begin
  if uid is null then raise exception 'é preciso estar conectado'; end if;

  select * into t from tournaments where id = p_tournament_id for update;
  if t.id is null then raise exception 'torneio inexistente'; end if;

  if not (is_admin(uid) or is_participante_do_torneio(p_tournament_id, uid)) then
    raise exception 'só quem está inscrito neste torneio pode começá-lo';
  end if;

  if t.status = 'EM_ANDAMENTO' then
    return t;  -- já começou; começar de novo não é erro, é clique repetido
  end if;
  if t.status = 'ENCERRADO' then
    raise exception 'este campeonato já foi encerrado';
  end if;

  select count(*) into v_inscritos
    from tournament_participants where tournament_id = p_tournament_id;
  if v_inscritos < 2 then
    raise exception 'são necessárias ao menos 2 pessoas inscritas para começar, há %', v_inscritos;
  end if;

  -- Sorteia as equipes se ainda não existem. A composição é a mesma regra de
  -- sempre: no máximo 2 por equipe, pelo número de inscritos.
  if not exists (select 1 from teams where tournament_id = p_tournament_id) then
    perform formar_equipes_interno(p_tournament_id);
  end if;

  -- Uma fase de grupos, se ainda não há fase nenhuma.
  select id into v_fase from phases where tournament_id = p_tournament_id order by ordem limit 1;
  if v_fase is null then
    insert into phases (tournament_id, kind, nome, ordem)
    values (p_tournament_id, 'GROUP', 'Fase de Grupos', 1)
    returning id into v_fase;
  end if;

  -- Confrontos todos contra todos, se a fase ainda está vazia.
  if not exists (select 1 from matches where phase_id = v_fase) then
    perform gerar_partidas_grupo_interno(v_fase);
  end if;

  -- A cadeia de estados do trigger não deixa pular de CONFIGURACAO direto para
  -- EM_ANDAMENTO; os dois passos acontecem na mesma transação e cada um fica
  -- registrado na auditoria, como já acontecia quando o admin clicava duas vezes.
  if t.status = 'CONFIGURACAO' then
    update tournaments set status = 'AGUARDANDO_INICIO', updated_at = now()
     where id = p_tournament_id;
  end if;
  update tournaments set status = 'EM_ANDAMENTO', updated_at = now()
   where id = p_tournament_id
  returning * into t;

  perform registrar_auditoria(
    p_acao          => 'INICIAR_TORNEIO',
    p_entidade      => 'tournaments',
    p_entidade_id   => p_tournament_id,
    p_tournament_id => p_tournament_id,
    p_depois        => jsonb_build_object('inscritos', v_inscritos),
    p_motivo        => case when is_admin(uid) then 'Início pelo administrador'
                            else 'Início por participante' end);

  return t;
end $$;

revoke execute on function iniciar_torneio(uuid) from public, anon;
grant  execute on function iniciar_torneio(uuid) to authenticated;

-- =============================================================================
-- 4. EXCLUSÃO: o que é histórico é a partida DISPUTADA
--
-- O botão de excluir sumia de qualquer torneio que já tivesse partidas — e
-- como começar um torneio agora gera os confrontos de uma vez, isso passou a
-- ser todo torneio, inclusive os de teste que nunca rolaram.
--
-- A regra de nunca apagar histórico continua valendo (§62). O que muda é onde
-- está a linha: histórico é partida ENCERRADA, com placar e gols registrados.
-- Uma partida agendada que nunca aconteceu não é histórico de nada.
-- =============================================================================

create or replace function excluir_torneio(p_tournament_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare t tournaments%rowtype; qtd_disputadas int;
begin
  if not is_admin(auth.uid()) then
    raise exception 'somente administrador pode excluir um torneio';
  end if;

  select * into t from tournaments where id = p_tournament_id for update;
  if t.id is null then raise exception 'torneio inexistente'; end if;

  select count(*) into qtd_disputadas
    from matches where tournament_id = p_tournament_id and status = 'FINISHED';
  if qtd_disputadas > 0 then
    raise exception
      'este torneio já tem % partida(s) disputada(s) e não pode ser excluído; encerre-o para tirá-lo do caminho',
      qtd_disputadas;
  end if;

  perform registrar_auditoria(
    p_acao          => 'EXCLUIR_TORNEIO',
    p_entidade      => 'tournaments',
    p_entidade_id   => p_tournament_id,
    p_antes         => to_jsonb(t),
    p_motivo        => format('Torneio "%s" excluído sem partidas disputadas', t.nome));

  -- Ordem obrigatória: eventos antes das partidas, partidas antes de fases e
  -- equipes. As FKs são `on delete restrict` de propósito.
  delete from match_events  where match_id in (select id from matches where tournament_id = p_tournament_id);
  delete from match_lineups where match_id in (select id from matches where tournament_id = p_tournament_id);
  delete from matches       where tournament_id = p_tournament_id;
  delete from team_players  where tournament_id = p_tournament_id;
  delete from teams         where tournament_id = p_tournament_id;
  delete from phases        where tournament_id = p_tournament_id;
  delete from tournaments   where id = p_tournament_id;
end $$;

revoke execute on function excluir_torneio(uuid) from public, anon;
grant  execute on function excluir_torneio(uuid) to authenticated;
