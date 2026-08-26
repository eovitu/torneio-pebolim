-- =============================================================================
-- CONDIÇÃO DE TÉRMINO DA PARTIDA
--
-- Decisão do proprietário (26/08/2026): o administrador escolhe como a partida
-- acaba.
--
--   TEMPO — o padrão de sempre, 3 minutos de tempo regulamentar;
--   GOLS  — acaba assim que uma equipe chega à meta, ignorando o cronômetro.
--
-- A escolha é do TORNEIO, e cada partida pode sobrescrever. Assim o admin
-- configura o campeonato uma vez e ajusta só a exceção. `null` em qualquer
-- nível significa "não escolhi, herda de cima".
--
-- A fonte de verdade da regra é `packages/domain/src/termino.ts`, coberta por
-- teste. O que existe aqui é o espelho dela (§45).
--
-- QUAL PLACAR CONTA: o ponderado, o mesmo que aparece no marcador (gol de
-- goleiro vale 2). "Termina com 3 gols" é o que quem olha o placar entende.
--
-- QUEM ENCERRA: o SERVIDOR, dentro de `registrar_gol`. Deixar isso para a tela
-- seria confiar o fim da partida a quem talvez esteja com a aba fechada — e
-- duas telas abertas encerrariam duas vezes. O cronômetro continua sendo do
-- juiz, porque parar o relógio é decisão humana; bater a meta não é.
-- =============================================================================

set search_path = public;

create type condicao_de_termino as enum ('TEMPO','GOLS');

alter table tournaments
  add column condicao_termino condicao_de_termino not null default 'TEMPO',
  add column gols_para_vencer smallint
    check (gols_para_vencer is null or gols_para_vencer between 1 and 20);

alter table matches
  add column condicao_termino condicao_de_termino,
  add column gols_para_vencer smallint
    check (gols_para_vencer is null or gols_para_vencer between 1 and 20);

-- -----------------------------------------------------------------------------
-- A regra que de fato vale para uma partida. Espelha `regraEfetiva`.
-- Condição por gols sem meta nenhuma volta ao tempo: configuração pela metade
-- não é regra, e o tempo sempre sabe terminar.
-- -----------------------------------------------------------------------------
create or replace function regra_de_termino(p_match_id uuid)
returns table (condicao condicao_de_termino, gols_para_vencer smallint)
language sql stable set search_path = public as $$
  select case when escolhida = 'GOLS' and meta is not null then 'GOLS'::condicao_de_termino
              else 'TEMPO'::condicao_de_termino end,
         case when escolhida = 'GOLS' then meta else null end
    from (
      select coalesce(m.condicao_termino, t.condicao_termino) as escolhida,
             case when m.condicao_termino = 'GOLS'
                  then coalesce(m.gols_para_vencer, t.gols_para_vencer)
                  else t.gols_para_vencer end as meta
        from matches m
        join tournaments t on t.id = m.tournament_id
       where m.id = p_match_id
    ) x;
$$;

-- -----------------------------------------------------------------------------
-- `registrar_gol` passa a encerrar a partida ao bater a meta.
--
-- Só o bloco final mudou em relação a 20260819213759: gol de ouro, permissão e
-- clock_ms do servidor continuam idênticos.
-- -----------------------------------------------------------------------------
create or replace function registrar_gol(
  p_match_id uuid, p_type match_event_type, p_team_id uuid, p_player_id uuid
) returns match_events
language plpgsql security definer set search_path = public as $$
declare
  m matches%rowtype; ev match_events%rowtype; agora timestamptz := now();
  r record; a integer; b integer;
begin
  if p_type not in ('NORMAL_GOAL','KEEPER_GOAL','OWN_GOAL') then
    raise exception '% não é um tipo de gol', p_type;
  end if;
  select * into m from matches where id = p_match_id for update;
  if m.id is null then raise exception 'partida inexistente'; end if;
  if not is_operador_da_partida(p_match_id, auth.uid()) then
    raise exception 'sem permissão para registrar gol nesta partida';
  end if;

  -- clock_ms vem do SERVIDOR. O cliente nunca escolhe o instante do gol.
  insert into match_events (match_id, type, team_id, player_id, clock_ms, created_by)
  values (p_match_id, p_type, p_team_id, p_player_id,
          coalesce(elapsed_ms(m, agora), 0), auth.uid())
  returning * into ev;

  -- statusAfterGoal(): GOLDEN_GOAL → FINISHED
  if m.status = 'GOLDEN_GOAL' then
    insert into match_events (match_id, type, clock_ms, created_by)
    values (p_match_id, 'MATCH_FINISHED', coalesce(elapsed_ms(m, agora), 0), auth.uid());
    update matches set status = 'FINISHED', finished_at = agora, updated_at = agora
     where id = p_match_id;

    if m.slot is not null then
      if m.phase_kind = 'DOUBLE_ELIMINATION' then perform avancar_eliminacao_dupla(m.phase_id);
      elsif m.phase_kind = 'KNOCKOUT'        then perform avancar_mata_mata(m.phase_id);
      end if;
    end if;

  elsif m.status in ('LIVE','PAUSED') then
    -- Meta batida encerra na hora, sem esperar o cronômetro nem o juiz.
    select * into r from regra_de_termino(p_match_id);
    if r.condicao = 'GOLS' and r.gols_para_vencer is not null then
      select gf_a, gf_b into a, b from placar_partida(p_match_id);
      if a >= r.gols_para_vencer or b >= r.gols_para_vencer then
        insert into match_events (match_id, type, clock_ms, created_by)
        values (p_match_id, 'MATCH_FINISHED', coalesce(elapsed_ms(m, agora), 0), auth.uid());
        update matches set status = 'FINISHED', finished_at = agora,
               status_antes_pausa = null, paused_at = null, updated_at = agora
         where id = p_match_id;

        if m.slot is not null then
          if m.phase_kind = 'DOUBLE_ELIMINATION' then perform avancar_eliminacao_dupla(m.phase_id);
          elsif m.phase_kind = 'KNOCKOUT'        then perform avancar_mata_mata(m.phase_id);
          end if;
        end if;
      end if;
    end if;
  end if;

  if m.status = 'FINISHED' then
    perform registrar_auditoria('CORRIGIR_PARTIDA_REGISTRAR_GOL', 'match_events', ev.id,
                                m.tournament_id, null, to_jsonb(ev), null);
  end if;
  return ev;
end $$;

-- -----------------------------------------------------------------------------
-- Configuração pelo administrador.
--
-- Partida já encerrada não é reconfigurada: mudaria a regra depois do
-- resultado. E a regra só pode mudar antes da bola rolar.
-- -----------------------------------------------------------------------------
create or replace function configurar_partida(
  p_match_id  uuid,
  p_condicao  condicao_de_termino default null,
  p_gols      smallint default null
) returns matches
language plpgsql security definer set search_path = public as $$
declare m matches%rowtype; antes jsonb;
begin
  if not is_admin(auth.uid()) then
    raise exception 'somente administrador pode configurar a partida';
  end if;

  select * into m from matches where id = p_match_id for update;
  if m.id is null then raise exception 'partida inexistente'; end if;
  if m.status <> 'SCHEDULED' then
    raise exception 'esta partida já começou: a regra de término só muda antes da bola rolar';
  end if;
  if p_condicao = 'GOLS' and p_gols is null then
    raise exception 'para terminar por gols é preciso dizer quantos';
  end if;

  antes := jsonb_build_object('condicao_termino', m.condicao_termino,
                              'gols_para_vencer', m.gols_para_vencer);

  update matches
     set condicao_termino  = p_condicao,
         gols_para_vencer  = case when p_condicao = 'GOLS' then p_gols else null end,
         updated_at        = now()
   where id = p_match_id
  returning * into m;

  perform registrar_auditoria('CONFIGURAR_PARTIDA', 'matches', p_match_id, m.tournament_id,
    antes,
    jsonb_build_object('condicao_termino', m.condicao_termino,
                       'gols_para_vencer', m.gols_para_vencer),
    'Regra de término da partida alterada');
  return m;
end $$;

-- -----------------------------------------------------------------------------
-- O padrão do torneio, que vale para toda partida que não escolheu a sua.
-- -----------------------------------------------------------------------------
create or replace function configurar_termino_do_torneio(
  p_tournament_id uuid,
  p_condicao      condicao_de_termino,
  p_gols          smallint default null
) returns tournaments
language plpgsql security definer set search_path = public as $$
declare t tournaments%rowtype; antes jsonb;
begin
  if not is_admin(auth.uid()) then
    raise exception 'somente administrador pode configurar o torneio';
  end if;

  select * into t from tournaments where id = p_tournament_id for update;
  if t.id is null then raise exception 'torneio inexistente'; end if;
  if p_condicao = 'GOLS' and p_gols is null then
    raise exception 'para terminar por gols é preciso dizer quantos';
  end if;

  antes := jsonb_build_object('condicao_termino', t.condicao_termino,
                              'gols_para_vencer', t.gols_para_vencer);

  update tournaments
     set condicao_termino = p_condicao,
         gols_para_vencer = case when p_condicao = 'GOLS' then p_gols else null end,
         updated_at       = now()
   where id = p_tournament_id
  returning * into t;

  perform registrar_auditoria('CONFIGURAR_TERMINO_TORNEIO', 'tournaments', p_tournament_id,
    p_tournament_id, antes,
    jsonb_build_object('condicao_termino', t.condicao_termino,
                       'gols_para_vencer', t.gols_para_vencer),
    'Regra de término padrão do torneio alterada');
  return t;
end $$;

revoke execute on function regra_de_termino(uuid) from public, anon;
grant  execute on function regra_de_termino(uuid) to authenticated, anon;
revoke execute on function configurar_partida(uuid, condicao_de_termino, smallint)
  from public, anon;
grant  execute on function configurar_partida(uuid, condicao_de_termino, smallint)
  to authenticated;
revoke execute on function configurar_termino_do_torneio(uuid, condicao_de_termino, smallint)
  from public, anon;
grant  execute on function configurar_termino_do_torneio(uuid, condicao_de_termino, smallint)
  to authenticated;
