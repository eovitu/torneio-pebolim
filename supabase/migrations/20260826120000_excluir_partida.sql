-- =============================================================================
-- EXCLUIR UMA PARTIDA (administração do torneio)
--
-- Pedido do proprietário (26/08/2026): excluir é diferente de cancelar. Cancelar
-- mantém a partida visível; excluir tira de vez, junto com os eventos dela.
-- Serve para desfazer partida criada por engano — inclusive as criadas na mão
-- para contornar um bug do chaveamento.
--
-- Sobre o §62 (não apagar histórico): a linha é respeitada porque NADA se perde
-- de verdade. Antes de excluir, a auditoria recebe um retrato completo da
-- partida — placar, escalação e a lista inteira de eventos. O que sai é a
-- partida da tela e das contas; o registro do que aconteceu fica.
--
-- Só administrador. E só fora do ar: partida em andamento é zerada
-- (`resetar_partida`) ou encerrada, nunca excluída no meio.
--
-- Sobre chaveamento: excluir uma partida que ocupa um slot de chave não
-- desmonta a chave. O chaveamento continua sendo a fonte de verdade, e o
-- próximo avanço recria o confronto se ele ainda fizer parte do desenho.
-- =============================================================================

set search_path = public;

create or replace function excluir_partida(p_match_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  m        matches%rowtype;
  a        integer;
  b        integer;
  retrato  jsonb;
begin
  if not is_admin(auth.uid()) then
    raise exception 'somente administrador pode excluir uma partida';
  end if;

  select * into m from matches where id = p_match_id for update;
  if m.id is null then raise exception 'partida inexistente'; end if;

  if m.status in ('LIVE','PAUSED','GOLDEN_GOAL') then
    raise exception 'esta partida está em andamento: encerre ou zere antes de excluir';
  end if;

  select gf_a, gf_b into a, b from placar_partida(p_match_id);

  -- O retrato é o que sobrevive à exclusão. Sem ele isto seria apagar
  -- histórico, e não corrigir um engano.
  retrato := jsonb_build_object(
    'partida',   to_jsonb(m),
    'placar_a',  a,
    'placar_b',  b,
    'equipe_a',  (select nome from teams where id = m.team_a_id),
    'equipe_b',  (select nome from teams where id = m.team_b_id),
    'escalacao', coalesce((select jsonb_agg(to_jsonb(l) order by l.player_id)
                             from match_lineups l where l.match_id = p_match_id), '[]'::jsonb),
    'eventos',   coalesce((select jsonb_agg(to_jsonb(e) order by e.seq)
                             from match_events e where e.match_id = p_match_id), '[]'::jsonb));

  perform registrar_auditoria(
    p_acao          => 'EXCLUIR_PARTIDA',
    p_entidade      => 'matches',
    p_entidade_id   => p_match_id,
    p_tournament_id => m.tournament_id,
    p_antes         => retrato,
    p_motivo        => format('Partida "%s" excluída pelo administrador', coalesce(nullif(m.label, ''), m.id::text)));

  -- Ordem obrigatória: as FKs são `on delete restrict` de propósito.
  delete from match_events  where match_id = p_match_id;
  delete from match_lineups where match_id = p_match_id;
  delete from matches       where id = p_match_id;
end $$;

revoke execute on function excluir_partida(uuid) from public, anon;
grant  execute on function excluir_partida(uuid) to authenticated;
