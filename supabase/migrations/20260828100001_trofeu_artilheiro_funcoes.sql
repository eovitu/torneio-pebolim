-- =============================================================================
-- TROFÉU DE ARTILHEIRO — as funções
--
-- Continuação de 20260828100000. Ficou em arquivo separado porque
-- `alter type ... add value` não pode compartilhar transação com o uso do valor
-- novo.
--
-- QUAL NÚMERO DECIDE
--
-- A ARTILHARIA LÍQUIDA, exatamente como `computePlayerStats` a define em
-- packages/domain/src/stats.ts: a soma do VALOR dos gols oficiais (o de goleiro
-- vale 2) menos um por cada gol contra cometido. Não é a contagem de bolas.
-- Gol removido não entra, e só partida encerrada conta — as mesmas duas
-- exclusões de `placar_partida`.
--
-- Artilharia zero ou negativa não premia ninguém: um torneio em que ninguém
-- marcou não tem artilheiro, e isso é diferente de ter um artilheiro com zero.
--
-- EMPATE
--
-- Todos os empatados no topo recebem. É o comportamento comum de chuteira de
-- ouro, e a alternativa — não premiar ninguém — puniria os dois por terem
-- jogado igualmente bem. Não há critério de desempate para artilharia definido
-- pelo proprietário, e este código não inventa um (§67).
-- =============================================================================

set search_path = public;

-- -----------------------------------------------------------------------------
-- Quem lidera a artilharia do torneio. Vazio quando ninguém marcou.
-- -----------------------------------------------------------------------------
create or replace function artilheiros_do_torneio(p_tournament_id uuid)
returns table (player_id uuid, team_id uuid, artilharia int)
language sql stable set search_path = public as $$
  with gols as (
    select ev.player_id, ev.type, ev.goal_value
      from match_events ev
      join matches m on m.id = ev.match_id
     where m.tournament_id = p_tournament_id
       and m.status = 'FINISHED'
       and ev.type in ('NORMAL_GOAL','KEEPER_GOAL','OWN_GOAL')
       and not exists (select 1 from match_events r
                        where r.type = 'GOAL_REMOVED' and r.removed_event_id = ev.id)
  ),
  liquida as (
    select g.player_id,
           (coalesce(sum(g.goal_value) filter (where g.type <> 'OWN_GOAL'), 0)
          - coalesce(count(*) filter (where g.type = 'OWN_GOAL'), 0))::int as artilharia
      from gols g
     group by g.player_id
  ),
  -- Só lidera quem marcou de verdade: zero não é artilharia.
  topo as (select max(l.artilharia) as valor from liquida l where l.artilharia > 0)
  select l.player_id, tp.team_id, l.artilharia
    from liquida l
    join topo on l.artilharia = topo.valor
    join team_players tp
      on tp.player_id = l.player_id and tp.tournament_id = p_tournament_id;
$$;

-- -----------------------------------------------------------------------------
-- Concede o troféu de artilheiro. Idempotente: recalcula do zero, para o caso
-- de um gol ser corrigido depois.
-- -----------------------------------------------------------------------------
create or replace function conceder_trofeu_artilheiro(p_tournament_id uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare concedidos int := 0;
begin
  delete from trofeus
   where tournament_id = p_tournament_id and posicao = 'ARTILHEIRO';

  insert into trofeus (tournament_id, team_id, player_id, posicao)
  select p_tournament_id, a.team_id, a.player_id, 'ARTILHEIRO'
    from artilheiros_do_torneio(p_tournament_id) a
  on conflict (tournament_id, player_id, posicao) do nothing;
  get diagnostics concedidos = row_count;

  if concedidos > 0 then
    perform registrar_auditoria(
      'CONCEDER_TROFEU_ARTILHEIRO', 'tournaments', p_tournament_id, p_tournament_id, null,
      jsonb_build_object('artilheiros',
        (select jsonb_agg(jsonb_build_object('player_id', player_id, 'artilharia', artilharia))
           from artilheiros_do_torneio(p_tournament_id))),
      'Torneio encerrado: troféu de artilheiro concedido');
  end if;

  return concedidos;
end $$;

-- -----------------------------------------------------------------------------
-- Encerrar o torneio concede o troféu.
--
-- É gatilho, e não uma chamada dentro de alguma RPC, porque encerrar o torneio
-- é um simples UPDATE de status vindo da tela — não existe função própria para
-- isso. `guardar_transicao_torneio` já garante que a transição é válida.
-- -----------------------------------------------------------------------------
create or replace function premiar_artilheiro_ao_encerrar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'ENCERRADO' and old.status is distinct from 'ENCERRADO' then
    perform conceder_trofeu_artilheiro(new.id);
  end if;
  return null;
end $$;

drop trigger if exists trg_50_premiar_artilheiro on tournaments;
create trigger trg_50_premiar_artilheiro
  after update of status on tournaments
  for each row execute function premiar_artilheiro_ao_encerrar();

-- -----------------------------------------------------------------------------
-- `conceder_trofeus` não pode mais apagar o que não é dele.
--
-- A limpeza removia todo troféu do torneio cujo dono não estivesse no pódio.
-- Com o artilheiro na mesma tabela, isso apagaria a chuteira de ouro na
-- primeira partida encerrada depois dela. A varredura passa a se limitar às
-- três posições de pódio, que são as únicas que essa função governa.
-- -----------------------------------------------------------------------------
create or replace function conceder_trofeus(p_phase_id uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare f phases%rowtype; total int := 0;
begin
  select * into f from phases where id = p_phase_id;
  if f.id is null or f.kind <> 'KNOCKOUT' then return 0; end if;

  if not exists (select 1 from podio_do_mata_mata(p_phase_id)) then
    return 0;
  end if;

  -- Varre só as posições que esta função governa. Sem o filtro de posição, a
  -- limpeza levaria junto o troféu de artilheiro, que mora na mesma tabela e
  -- não tem nada a ver com o pódio.
  --
  -- A comparação inclui a POSIÇÃO: com a constraint agora por posição, um
  -- jogador que trocou de degrau (um placar corrigido inverte campeão e vice)
  -- não tem a linha antiga sobrescrita pelo upsert — ela precisa sair aqui.
  delete from trofeus t
   where t.tournament_id = f.tournament_id
     and t.posicao in ('CAMPEAO','VICE','TERCEIRO')
     and not exists (
       select 1
         from podio_do_mata_mata(p_phase_id) p
         join team_players tp
           on tp.team_id = p.team_id and tp.tournament_id = f.tournament_id
        where tp.player_id = t.player_id and p.posicao = t.posicao);

  insert into trofeus (tournament_id, team_id, player_id, posicao)
  select f.tournament_id, p.team_id, tp.player_id, p.posicao
    from podio_do_mata_mata(p_phase_id) p
    join team_players tp
      on tp.team_id = p.team_id and tp.tournament_id = f.tournament_id
  on conflict (tournament_id, player_id, posicao) do update
     set team_id = excluded.team_id
   where trofeus.team_id is distinct from excluded.team_id;

  select count(*) into total from trofeus where tournament_id = f.tournament_id;

  perform registrar_auditoria(
    'CONCEDER_TROFEUS', 'phases', p_phase_id, f.tournament_id, null,
    jsonb_build_object('trofeus', total,
      'podio', (select jsonb_agg(jsonb_build_object('posicao', posicao, 'team_id', team_id)
                                 order by posicao)
                  from podio_do_mata_mata(p_phase_id))),
    'Pódio sincronizado: cada posição é premiada assim que é decidida');

  return total;
end $$;

revoke execute on function premiar_artilheiro_ao_encerrar() from public, anon, authenticated;
revoke execute on function artilheiros_do_torneio(uuid) from public, anon;
grant  execute on function artilheiros_do_torneio(uuid) to authenticated, anon;
revoke execute on function conceder_trofeu_artilheiro(uuid) from public, anon;
grant  execute on function conceder_trofeu_artilheiro(uuid) to authenticated;
