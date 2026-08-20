-- =============================================================================
-- RODÍZIO DE QUEM JOGA SOZINHO
--
-- Regra definida pelo proprietário em 20/08/2026. Com número ímpar de
-- participantes uma equipe fica com uma pessoa só, e ninguém pode ficar
-- sozinho o campeonato inteiro. Depois de cada partida encerrada, a equipe que
-- PERDEU empresta um jogador para acompanhar quem está sozinho; quem sobrou na
-- perdedora passa a ser o sozinho da vez.
--
--   Antes:   [A+B]  [C+D]  [E]        A+B perde para C+D
--   Depois:  [A]    [C+D]  [E+B]      B foi para o E, A ficou sozinho
--
-- Decisões do proprietário, ponto a ponto:
--   - vai quem JÁ FICOU MAIS VEZES SOZINHO (ele escapa do solo e a vez passa
--     para o companheiro); desempate por quem menos formou dupla com o
--     solitário atual, para não repetir sempre o mesmo par;
--   - se quem perdeu foi a própria equipe de um, NADA muda — não há quem
--     emprestar, e o rodízio espera a próxima derrota de uma dupla;
--   - acontece a cada partida encerrada;
--   - quem confirma é o JUIZ da partida (quem a iniciou), não o administrador.
--
-- A regra de escolha vive em packages/domain/src/rodizio.ts, coberta por
-- teste. O que está aqui é o espelho dela mais a contagem do histórico.
--
-- Nada de novo é inventado sobre estatística: `match_lineups` já é um retrato
-- por partida, então trocar o elenco agora não reescreve o passado. As
-- partidas já encerradas guardam a escalação que tiveram.
-- =============================================================================

-- Marca que o rodízio desta partida já foi decidido — aceito ou recusado —
-- para a tela parar de perguntar.
alter table matches add column rodizio_resolvido_em timestamptz;

-- -----------------------------------------------------------------------------
-- Quantas partidas encerradas o jogador disputou como equipe de UMA pessoa.
-- -----------------------------------------------------------------------------
create function partidas_jogadas_sozinho(p_tournament_id uuid, p_player_id uuid)
returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int
    from match_lineups ml
    join matches m on m.id = ml.match_id
   where ml.player_id = p_player_id
     and m.tournament_id = p_tournament_id
     and m.status = 'FINISHED'
     and (select count(*) from match_lineups x
           where x.match_id = ml.match_id and x.team_id = ml.team_id) = 1;
$$;

-- -----------------------------------------------------------------------------
-- Quantas vezes os dois jogaram na MESMA equipe, em partidas encerradas.
-- -----------------------------------------------------------------------------
create function vezes_na_mesma_equipe(p_tournament_id uuid, p_a uuid, p_b uuid)
returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int
    from match_lineups la
    join match_lineups lb
      on lb.match_id = la.match_id and lb.team_id = la.team_id
    join matches m on m.id = la.match_id
   where la.player_id = p_a and lb.player_id = p_b
     and m.tournament_id = p_tournament_id
     and m.status = 'FINISHED';
$$;

-- -----------------------------------------------------------------------------
-- A sugestão de rodízio para uma partida encerrada.
-- Não devolve linha nenhuma quando não há rodízio a fazer.
-- -----------------------------------------------------------------------------
create function rodizio_sugerido(p_match_id uuid)
returns table (
  vai_player_id     uuid,
  vai_nome          text,
  vai_sozinho       int,
  fica_player_id    uuid,
  fica_nome         text,
  fica_sozinho      int,
  de_team_id        uuid,
  de_equipe         text,
  para_team_id      uuid,
  para_equipe       text,
  solitario_nome    text
)
language plpgsql stable security definer set search_path = public as $$
declare
  m           matches%rowtype;
  gf_a int; gf_b int;
  v_perdedora uuid;
  v_solitaria uuid;
  v_solitario uuid;
begin
  select * into m from matches where id = p_match_id;
  if m.id is null or m.status <> 'FINISHED' then return; end if;
  if m.rodizio_resolvido_em is not null then return; end if;

  -- Empate não tem perdedora: nada a fazer.
  select p.gf_a, p.gf_b into gf_a, gf_b from placar_partida(p_match_id) p;
  if gf_a = gf_b then return; end if;
  v_perdedora := case when gf_a < gf_b then m.team_a_id else m.team_b_id end;

  -- A equipe de uma pessoa só do torneio, se existir.
  select tp.team_id into v_solitaria
    from team_players tp
   where tp.tournament_id = m.tournament_id
   group by tp.team_id
  having count(*) = 1
   limit 1;
  if v_solitaria is null then return; end if;

  -- Quem perdeu foi o próprio solitário: não há quem emprestar (decisão do
  -- proprietário — a composição segue igual até uma dupla perder).
  if v_perdedora = v_solitaria then return; end if;

  -- Emprestar exige ter dois.
  if (select count(*) from team_players where team_id = v_perdedora) < 2 then return; end if;

  select tp.player_id into v_solitario from team_players tp where tp.team_id = v_solitaria;

  return query
  with candidatos as (
    select p.id, p.nome,
           partidas_jogadas_sozinho(m.tournament_id, p.id) as sozinho,
           vezes_na_mesma_equipe(m.tournament_id, p.id, v_solitario) as com_solitario
      from team_players tp
      join players p on p.id = tp.player_id
     where tp.team_id = v_perdedora
  ),
  ordenados as (
    -- Espelha `ordenarCandidatos` do domínio: mais solo primeiro, depois quem
    -- menos jogou com o solitário, depois nome (desempate técnico).
    select c.*, row_number() over (
             order by c.sozinho desc, c.com_solitario asc, c.nome collate "pt-BR" asc
           ) as posicao
      from candidatos c
  )
  select v.id, v.nome, v.sozinho,
         f.id, f.nome, f.sozinho,
         v_perdedora, (select nome from teams where id = v_perdedora),
         v_solitaria, (select nome from teams where id = v_solitaria),
         (select nome from players where id = v_solitario)
    from ordenados v
    join ordenados f on f.posicao = 2
   where v.posicao = 1;
end $$;

revoke execute on function rodizio_sugerido(uuid) from public, anon;
grant  execute on function rodizio_sugerido(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Aplica (ou recusa) o rodízio.
--
-- Quem decide é o JUIZ da partida — quem a iniciou —, e não o administrador.
-- Foi decisão explícita do proprietário: quem está com o celular conduzindo o
-- jogo é quem aceita a dupla nova.
--
-- Recusar também resolve: a composição segue como está e a tela para de
-- perguntar.
-- -----------------------------------------------------------------------------
create function resolver_rodizio(p_match_id uuid, p_aceitar boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  m   matches%rowtype;
  s   record;
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'é preciso estar conectado'; end if;

  select * into m from matches where id = p_match_id for update;
  if m.id is null then raise exception 'partida inexistente'; end if;
  if m.status <> 'FINISHED' then
    raise exception 'o rodízio só é decidido depois que a partida termina';
  end if;
  if m.rodizio_resolvido_em is not null then
    raise exception 'o rodízio desta partida já foi decidido';
  end if;

  -- O juiz da partida, quem a iniciou, ou um administrador.
  if not (is_admin(uid) or m.arbitro_user_id = uid or m.iniciada_por = uid) then
    raise exception 'só quem conduziu esta partida pode decidir o rodízio';
  end if;

  if p_aceitar then
    select * into s from rodizio_sugerido(p_match_id);
    if s.vai_player_id is null then
      raise exception 'não há rodízio a aplicar nesta partida';
    end if;

    -- Apagar e inserir de novo, em vez de UPDATE, porque é o INSERT/DELETE que
    -- dispara `trg_30_ressincronizar_escalacoes` e reescreve a escalação das
    -- partidas ainda AGENDADAS. As encerradas mantêm o retrato que tinham.
    delete from team_players
     where team_id = s.de_team_id and player_id = s.vai_player_id;
    insert into team_players (team_id, player_id, tournament_id)
    values (s.para_team_id, s.vai_player_id, m.tournament_id);

    perform registrar_auditoria(
      p_acao          => 'APLICAR_RODIZIO',
      p_entidade      => 'team_players',
      p_entidade_id   => s.vai_player_id,
      p_tournament_id => m.tournament_id,
      p_antes         => jsonb_build_object('equipe', s.de_equipe),
      p_depois        => jsonb_build_object('equipe', s.para_equipe,
                                            'fica_sozinho', s.fica_nome,
                                            'partidas_sozinho_de_quem_foi', s.vai_sozinho),
      p_motivo        => 'Rodízio de quem joga sozinho');
  else
    perform registrar_auditoria(
      p_acao          => 'RECUSAR_RODIZIO',
      p_entidade      => 'matches',
      p_entidade_id   => p_match_id,
      p_tournament_id => m.tournament_id,
      p_motivo        => 'O juiz da partida recusou a recomposição');
  end if;

  update matches set rodizio_resolvido_em = now(), updated_at = now()
   where id = p_match_id;
end $$;

revoke execute on function resolver_rodizio(uuid, boolean) from public, anon;
grant  execute on function resolver_rodizio(uuid, boolean) to authenticated;

-- Funções de apoio não precisam estar na API pública.
revoke execute on function partidas_jogadas_sozinho(uuid, uuid) from public, anon;
revoke execute on function vezes_na_mesma_equipe(uuid, uuid, uuid) from public, anon;
