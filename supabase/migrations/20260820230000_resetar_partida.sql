-- =============================================================================
-- ZERAR A PARTIDA
--
-- Pedido do proprietário (20/08/2026): acontece de a partida começar e o
-- relógio travar, e hoje não existe saída — encerrar grava um resultado falso
-- na classificação e não dá para recomeçar.
--
-- Decisão do proprietário sobre a semântica: zerar devolve a partida ao estado
-- AGENDADA, zera o relógio e ANULA os gols já registrados. "Como se nunca
-- tivesse começado", mas sem apagar nada:
--
--   - cada gol válido recebe um `GOAL_REMOVED` apontando para ele (§29/§51);
--   - os eventos de relógio (início, pausa, retomada) continuam no histórico;
--   - o ato fica registrado na auditoria, com quem zerou e o placar anulado.
--
-- Quem pode: as mesmas pessoas que operam a partida —
-- `is_operador_da_partida` (§39). Não é privilégio de administrador: quem está
-- com o celular na mão é quem precisa da saída.
--
-- Partida ENCERRADA não é zerada por aqui: o resultado já valeu para a
-- classificação, e desfazer isso é correção administrativa, não operação.
-- =============================================================================

create function resetar_partida(p_match_id uuid) returns matches
language plpgsql security definer set search_path = public as $$
declare
  m      matches%rowtype;
  agora  timestamptz := now();
  g      record;
  a      integer;
  b      integer;
  anulados int := 0;
begin
  select * into m from matches where id = p_match_id for update;
  if m.id is null then raise exception 'partida inexistente'; end if;

  if m.status = 'SCHEDULED' then
    raise exception 'esta partida ainda não começou';
  end if;
  if m.status = 'FINISHED' then
    raise exception 'partida encerrada: o resultado já valeu para a classificação e só um administrador pode corrigi-la';
  end if;
  if not is_operador_da_partida(p_match_id, auth.uid()) then
    raise exception 'sem permissão para zerar esta partida';
  end if;

  select gf_a, gf_b into a, b from placar_partida(p_match_id);

  -- Anular, e não apagar: o gol errado continua no histórico, riscado.
  for g in
    select e.id from match_events e
     where e.match_id = p_match_id
       and e.type in ('NORMAL_GOAL','KEEPER_GOAL','OWN_GOAL')
       and not exists (select 1 from match_events r
                        where r.match_id = p_match_id
                          and r.type = 'GOAL_REMOVED'
                          and r.removed_event_id = e.id)
     order by e.seq
  loop
    insert into match_events (match_id, type, removed_event_id, reason, clock_ms, created_by)
    values (p_match_id, 'GOAL_REMOVED', g.id, 'Partida zerada',
            coalesce(elapsed_ms(m, agora), 0), auth.uid());
    anulados := anulados + 1;
  end loop;

  update matches
     set status                = 'SCHEDULED',
         started_at            = null,
         paused_at             = null,
         status_antes_pausa    = null,
         accumulated_paused_ms = 0,
         finished_at           = null,
         rodizio_resolvido_em  = null,
         iniciada_por          = null,
         arbitro_user_id       = null,
         updated_at            = agora
   where id = p_match_id
  returning * into m;

  perform registrar_auditoria(
    p_acao          => 'ZERAR_PARTIDA',
    p_entidade      => 'matches',
    p_entidade_id   => p_match_id,
    p_tournament_id => m.tournament_id,
    p_antes         => jsonb_build_object('placar_a', a, 'placar_b', b),
    p_depois        => jsonb_build_object('gols_anulados', anulados),
    p_motivo        => 'Partida zerada pelo responsável: relógio e placar voltam ao início');

  return m;
end $$;

revoke execute on function resetar_partida(uuid) from public, anon;
grant  execute on function resetar_partida(uuid) to authenticated;
