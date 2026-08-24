-- =============================================================================
-- Remove a tolerância de 2 segundos após o tempo regulamentar
--
-- MUDANÇA DE REGRA (decisão do proprietário, 24/08/2026): a tolerância de
-- registro de 2 segundos após 00:00 (introduzida em
-- 20260820020000_partida_ao_vivo_e_perfil.sql) deixa de existir. A partida só
-- trava de verdade quando o operador clica em "Encerrar" manualmente — o
-- status virando FINISHED é o único gatilho que impede novo evento. Enquanto
-- a partida não for encerrada, mesmo com o cronômetro parado em 00:00 há muito
-- tempo, o operador ainda pode registrar gol, desfazer gol e registrar gol
-- contra normalmente.
-- =============================================================================

create or replace function registrar_gol(
  p_match_id uuid, p_type match_event_type, p_team_id uuid, p_player_id uuid
) returns match_events
language plpgsql security definer set search_path to 'public' as $$
declare
  m         matches%rowtype;
  ev        match_events%rowtype;
  agora     timestamptz := now();
  decorrido integer;
begin
  if p_type not in ('NORMAL_GOAL','KEEPER_GOAL','OWN_GOAL') then
    raise exception '% não é um tipo de gol', p_type;
  end if;
  select * into m from matches where id = p_match_id for update;
  if m.id is null then raise exception 'partida inexistente'; end if;
  if not is_operador_da_partida(p_match_id, auth.uid()) then
    raise exception 'sem permissão para registrar gol nesta partida';
  end if;

  decorrido := coalesce(elapsed_ms(m, agora), 0);

  -- clock_ms vem do SERVIDOR. O cliente nunca escolhe o instante do gol.
  insert into match_events (match_id, type, team_id, player_id, clock_ms, created_by)
  values (p_match_id, p_type, p_team_id, p_player_id, decorrido, auth.uid())
  returning * into ev;

  -- statusAfterGoal(): GOLDEN_GOAL → FINISHED
  if m.status = 'GOLDEN_GOAL' then
    insert into match_events (match_id, type, clock_ms, created_by)
    values (p_match_id, 'MATCH_FINISHED', decorrido, auth.uid());
    update matches set status = 'FINISHED', finished_at = agora, updated_at = agora
     where id = p_match_id;
  end if;

  if m.status = 'FINISHED' then
    perform registrar_auditoria('CORRIGIR_PARTIDA_REGISTRAR_GOL', 'match_events', ev.id,
                                m.tournament_id, null, to_jsonb(ev), null);
  end if;
  return ev;
end $$;
