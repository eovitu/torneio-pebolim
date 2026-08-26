-- =============================================================================
-- Confronto manual de mata-mata não fura a chave gerada
--
-- `criar_partida_mata_mata` nasceu quando o mata-mata não tinha chaveamento:
-- o admin escolhia cada confronto na mão. Agora que a chave é gerada pela
-- classificação e anda sozinha, uma partida criada por fora dela ficaria sem
-- `slot` — invisível para `avancar_mata_mata`, fora do desenho da chave e fora
-- do pódio, mas contando nas estatísticas. Foi exatamente esse descompasso que
-- produziu as partidas avulsas que precisaram ser corrigidas à mão.
--
-- A função continua existindo para a fase de mata-mata SEM chaveamento (um
-- torneio conduzido inteiramente na mão ainda é possível). O que ela passa a
-- recusar é criar confronto numa fase que já tem chave: ali quem manda é o
-- chaveamento.
-- =============================================================================

set search_path = public;

create or replace function criar_partida_mata_mata(
  p_phase_id uuid,
  p_team_a_id uuid,
  p_team_b_id uuid,
  p_agendada_para timestamptz default null
) returns matches
language plpgsql security definer set search_path to 'public' as $$
declare f phases%rowtype; m matches%rowtype; proxima int;
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

  -- A chave é a fonte de verdade desta fase. Uma partida fora dela não seria
  -- vista pelo avanço nem pelo pódio, e ainda assim contaria nas estatísticas.
  if f.chaveamento is not null then
    raise exception
      'esta fase já tem chaveamento: os confrontos são criados pela própria chave conforme as partidas terminam';
  end if;

  if p_team_a_id = p_team_b_id then
    raise exception 'uma equipe não pode enfrentar a si mesma';
  end if;
  if not exists (select 1 from teams where id = p_team_a_id and tournament_id = f.tournament_id)
     or not exists (select 1 from teams where id = p_team_b_id and tournament_id = f.tournament_id) then
    raise exception 'as duas equipes precisam ser deste torneio';
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
