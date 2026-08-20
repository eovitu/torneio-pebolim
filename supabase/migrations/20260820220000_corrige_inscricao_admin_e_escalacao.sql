-- =============================================================================
-- CORRIGE A INSCRIÇÃO PELO ADMIN E GARANTE A ESCALAÇÃO DA PARTIDA
--
-- Dois defeitos encontrados no primeiro uso real com duplas.
--
-- 1. INSCRIÇÃO PELO ADMIN NÃO GRAVAVA
--    `tournament_participants` recebeu policies de INSERT e DELETE em
--    20260820071153, mas o GRANT correspondente nunca foi dado — só
--    `grant select`. Policy sem grant não escreve: o Postgres barra antes de
--    olhar a policy. O painel criava o `players`, e a linha de inscrição era
--    recusada logo depois; a pessoa aparecia cadastrada e fora do torneio.
--    O mesmo valia para o botão Remover.
--
-- 2. PARTIDA SEM ESCALAÇÃO ⇒ NENHUM GOL PODE SER REGISTRADO
--    `match_lineups` é o que sustenta três coisas: os botões de gol por
--    jogador, `validar_evento` (o autor precisa estar escalado naquela
--    equipe) e `is_operador_da_partida` (quem joga pode operar). Uma partida
--    que perca a escalação vira uma tela sem jogador nenhum — sobra só o
--    botão de gol contra, que abre um modal vazio — e nenhum gol entra.
--    Era exatamente o quadro relatado nas partidas de dupla.
--
--    A escalação já era preenchida por gatilho ao criar a partida, mas nada
--    garantia que ela continuasse lá. Passa a haver garantia em dois pontos:
--    ao iniciar a partida e por uma ação explícita do administrador.
--
-- Nada aqui altera regra esportiva, placar, artilharia ou permissão.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Inscrição pelo administrador: o grant que faltava.
--
-- As policies `participantes_insert_admin` e
-- `participantes_delete_admin_ou_proprio` continuam sendo quem decide QUEM
-- escreve. O grant apenas abre a porta para a policy ser consultada.
-- -----------------------------------------------------------------------------
grant insert, delete on tournament_participants to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Escalação garantida.
--
-- `garantir_escalacao` só age quando a partida está SEM escalação nenhuma.
-- Uma escalação parcial pode ser um retrato legítimo (o rodízio reescreve as
-- partidas AGENDADAS), e partida encerrada é imutável — refazer por cima
-- apagaria quem de fato jogou. Escalação vazia, porém, nunca é um retrato:
-- é ausência de dado.
-- -----------------------------------------------------------------------------
create function garantir_escalacao(p_match_id uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare qtd int;
begin
  select count(*) into qtd from match_lineups where match_id = p_match_id;
  if qtd > 0 then return qtd; end if;

  insert into match_lineups (match_id, team_id, player_id)
  select m.id, tp.team_id, tp.player_id
    from matches m
    join team_players tp on tp.team_id in (m.team_a_id, m.team_b_id)
   where m.id = p_match_id
  on conflict do nothing;

  select count(*) into qtd from match_lineups where match_id = p_match_id;
  return qtd;
end $$;

-- Ação explícita do administrador, para o caso de uma partida já em curso
-- ficar sem escalação. Refaz do elenco atual das duas equipes e fica na
-- auditoria — corrigir escalação de partida disputada é intervenção (§48).
create function ressincronizar_escalacao(p_match_id uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare m matches%rowtype; qtd int;
begin
  if not is_admin(auth.uid()) then
    raise exception 'somente administrador pode refazer a escalação';
  end if;

  select * into m from matches where id = p_match_id for update;
  if m.id is null then raise exception 'partida inexistente'; end if;

  perform sincronizar_escalacao(p_match_id);
  select count(*) into qtd from match_lineups where match_id = p_match_id;

  perform registrar_auditoria(
    p_acao          => 'RESSINCRONIZAR_ESCALACAO',
    p_entidade      => 'match_lineups',
    p_entidade_id   => p_match_id,
    p_tournament_id => m.tournament_id,
    p_depois        => jsonb_build_object('escalados', qtd),
    p_motivo        => 'Escalação refeita a partir do elenco atual das equipes');

  return qtd;
end $$;

revoke execute on function garantir_escalacao(uuid)      from public, anon, authenticated;
revoke execute on function ressincronizar_escalacao(uuid) from public, anon;
grant  execute on function ressincronizar_escalacao(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Iniciar partida passa a garantir a escalação antes de soltar o relógio.
--
-- É o último momento em que dá para consertar sem custo: depois do apito, uma
-- partida sem escalação não aceita gol nenhum e quem está com o celular na
-- mão não tem saída. Só o corpo mudou; a assinatura e as permissões são as
-- mesmas de 20260819213759.
-- -----------------------------------------------------------------------------
create or replace function iniciar_partida(p_match_id uuid) returns matches
language plpgsql security definer set search_path = public as $$
declare m matches%rowtype; agora timestamptz := now(); st_torneio tournament_status; escalados int;
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

  escalados := garantir_escalacao(p_match_id);
  if escalados = 0 then
    raise exception 'esta partida está sem escalação: as equipes precisam ter jogadores antes de começar';
  end if;

  update matches set status = 'LIVE', started_at = agora,
         iniciada_por = auth.uid(), arbitro_user_id = auth.uid(), updated_at = agora
   where id = p_match_id returning * into m;

  insert into match_events (match_id, type, clock_ms, created_by)
  values (p_match_id, 'MATCH_STARTED', 0, auth.uid());
  return m;
end $$;

-- -----------------------------------------------------------------------------
-- 4. Reparo dos dados existentes.
--
-- Toda partida sem escalação nenhuma recebe o elenco atual das suas equipes.
-- Não toca em quem já tem escalação — inclusive as encerradas, cujo retrato
-- é preservado.
-- -----------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in select m.id from matches m
            where not exists (select 1 from match_lineups ml where ml.match_id = m.id)
  loop
    perform garantir_escalacao(r.id);
  end loop;
end $$;
