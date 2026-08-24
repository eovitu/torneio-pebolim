-- =============================================================================
-- Mata-mata (KNOCKOUT) não depende mais do encerramento da fase anterior
--
-- `criar_partida_mata_mata` exigia que a fase imediatamente anterior (por
-- `ordem`) já estivesse encerrada antes de aceitar qualquer confronto. Essa
-- checagem nunca foi uma regra oficial do campeonato (não consta em nenhuma
-- decisão do proprietário) e é inconsistente com a irmã `gerar_eliminacao_dupla`
-- (Copa), que sempre permitiu gerar o chaveamento independente do estado de
-- fases anteriores. Na prática ela travava o uso real: o admin criava a fase de
-- mata-mata e não conseguia criar confronto nenhum até lembrar de voltar e
-- clicar "Encerrar fase" na fase de grupos, mesmo com todas as partidas dela já
-- disputadas.
--
-- Decisão do proprietário: remover a exigência. O mata-mata passa a se
-- comportar como a Copa — confrontos podem ser criados a qualquer momento,
-- desde que a própria fase de mata-mata não esteja encerrada.
-- =============================================================================

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
