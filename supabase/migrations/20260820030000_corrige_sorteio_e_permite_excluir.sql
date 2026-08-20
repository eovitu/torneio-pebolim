-- =============================================================================
-- torneio-pebolim — correção do sorteio, do service_role e saída para testes
--
--   1. `sortear_equipes` quebrava quando chamada sem semente — que é
--      exatamente como a tela chama.
--   2. `service_role` não tinha privilégio em tabela nenhuma, o que derrubava
--      a Edge Function de criação de contas.
--   3. Um torneio criado para teste ficava preso: não havia como excluir nem
--      como encerrar antes de percorrer o fluxo inteiro.
-- =============================================================================

set search_path = public;

-- -----------------------------------------------------------------------------
-- 0. PRIVILÉGIOS DO service_role
--
-- DEFEITO: a migration de hardening concedeu privilégios de tabela a `anon` e
-- `authenticated`, mas esqueceu `service_role` — que também estava com apenas
-- REFERENCES/TRIGGER/TRUNCATE.
--
-- O efeito apareceu longe da causa: a Edge Function `admin-criar-usuario`
-- consultava `user_roles` para conferir se quem chamou é administrador, a
-- consulta era negada por permissão, a lista voltava vazia e a função concluía
-- "não é admin" — respondendo 403 a um administrador legítimo.
--
-- `service_role` é a identidade do backend: ela ignora RLS por natureza e a
-- chave nunca chega ao navegador (fica só no ambiente da Edge Function). Isto
-- restaura o padrão do Supabase, e evita que a próxima função server-side
-- falhe pelo mesmo motivo.
-- -----------------------------------------------------------------------------
grant all privileges on all tables    in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant all privileges on all functions in schema public to service_role;

alter default privileges in schema public grant all on tables    to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on functions to service_role;

-- -----------------------------------------------------------------------------
-- 1. SEMENTE PADRÃO DO SORTEIO
--
-- DEFEITO: a semente vinha de
--     extract(microseconds from clock_timestamp()) / 1000000
-- e `extract(microseconds ...)` devolve os SEGUNDOS somados aos microssegundos
-- (0 a 59.999.999), não a fração do segundo. O resultado caía entre 0 e 60,
-- enquanto `setseed` só aceita [-1, 1] — então qualquer sorteio sem semente
-- explícita morria com "setseed parameter 19.08 is out of allowed range".
--
-- Passou despercebido porque todos os testes passavam uma semente fixa, para
-- verificar a reprodutibilidade; o caminho do valor automático nunca rodou.
--
-- `random()` já devolve [0,1), que é sempre válido, e continua sendo gravado
-- na auditoria — a reprodutibilidade do sorteio não muda.
-- -----------------------------------------------------------------------------
create or replace function sortear_equipes(
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
  if p_seed is not null and (p_seed < -1 or p_seed > 1) then
    raise exception 'a semente precisa estar entre -1 e 1';
  end if;

  -- Semente explícita permite refazer um sorteio para conferência; sem ela,
  -- sorteamos uma. Em qualquer caso ela fica registrada na auditoria.
  semente := coalesce(p_seed, random());
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
-- 2. ENCERRAR DE QUALQUER ESTADO
--
-- A cadeia linear que eu havia escrito só deixava chegar a ENCERRADO vindo de
-- EM_ANDAMENTO. Na prática isso prendia um torneio de teste: para se livrar
-- dele era preciso percorrer todo o fluxo como se fosse de verdade.
--
-- Encerrar passa a ser possível de qualquer estado — é a saída, e nenhuma
-- regra esportiva depende do caminho até ela. O resto da cadeia continua
-- valendo: não se pula de CONFIGURACAO direto para EM_ANDAMENTO, e de
-- ENCERRADO não se volta.
-- -----------------------------------------------------------------------------
create or replace function guardar_transicao_torneio() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = old.status then return new; end if;

  if not (
       (old.status = 'CONFIGURACAO'      and new.status = 'AGUARDANDO_INICIO')
    or (old.status = 'AGUARDANDO_INICIO' and new.status in ('CONFIGURACAO','EM_ANDAMENTO'))
    -- Encerrar é sempre possível: é a saída para um torneio abandonado.
    or (old.status <> 'ENCERRADO'        and new.status = 'ENCERRADO')
  ) then
    raise exception 'transição de torneio inválida: % → %', old.status, new.status;
  end if;

  perform registrar_auditoria('ALTERAR_STATUS_TORNEIO', 'tournaments', new.id, new.id,
                              jsonb_build_object('status', old.status),
                              jsonb_build_object('status', new.status), null);
  return new;
end $$;

-- -----------------------------------------------------------------------------
-- 3. EXCLUIR TORNEIO
--
-- Exclusão é permitida SOMENTE enquanto não existe nenhuma partida. Uma vez
-- que há partida, há histórico — e histórico não se apaga (§62). Nesse caso a
-- saída é encerrar, que preserva tudo.
--
-- Jogadores NÃO são excluídos: eles existem fora do torneio e podem estar em
-- outros. Somem apenas as equipes, os elencos e as fases deste torneio.
--
-- A auditoria é gravada ANTES da exclusão, com o nome do torneio, para que o
-- registro continue legível depois que a linha não existir mais.
-- -----------------------------------------------------------------------------
create function excluir_torneio(p_tournament_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare t tournaments%rowtype; qtd_partidas int;
begin
  if not is_admin(auth.uid()) then
    raise exception 'somente administrador pode excluir um torneio';
  end if;

  select * into t from tournaments where id = p_tournament_id for update;
  if t.id is null then raise exception 'torneio inexistente'; end if;

  select count(*) into qtd_partidas from matches where tournament_id = p_tournament_id;
  if qtd_partidas > 0 then
    raise exception
      'este torneio já tem % partida(s) e não pode ser excluído; encerre-o para tirá-lo do caminho',
      qtd_partidas;
  end if;

  perform registrar_auditoria('EXCLUIR_TORNEIO', 'tournaments', p_tournament_id, null,
                              to_jsonb(t), null,
                              format('Torneio "%s" excluído sem partidas disputadas', t.nome));

  delete from team_players where tournament_id = p_tournament_id;
  delete from teams        where tournament_id = p_tournament_id;
  delete from phases       where tournament_id = p_tournament_id;
  delete from tournaments  where id = p_tournament_id;
end $$;

revoke execute on function excluir_torneio(uuid) from public, anon, authenticated;
grant  execute on function excluir_torneio(uuid) to authenticated;
