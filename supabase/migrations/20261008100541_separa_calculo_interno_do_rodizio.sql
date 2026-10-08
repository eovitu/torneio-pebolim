-- Separa a RPC pública do cálculo privilegiado usado depois de autorização.
-- O cliente continua recebendo zero linhas para partida privada; o juiz
-- autorizado pode resolver o rodízio sem tornar o roster legível pela RPC.

create function rodizio_sugerido_interno(p_match_id uuid)
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

  select p.gf_a, p.gf_b into gf_a, gf_b from placar_partida(p_match_id) p;
  if gf_a = gf_b then return; end if;
  v_perdedora := case when gf_a < gf_b then m.team_a_id else m.team_b_id end;

  select tp.team_id into v_solitaria
    from team_players tp
   where tp.tournament_id = m.tournament_id
   group by tp.team_id
  having count(*) = 1
   limit 1;
  if v_solitaria is null then return; end if;
  if v_perdedora = v_solitaria then return; end if;
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

-- Esta função só é invocada por wrappers SECURITY DEFINER após validação de
-- visibilidade ou de autorização. Não conceder EXECUTE aos papéis da API.
revoke all on function rodizio_sugerido_interno(uuid) from public, anon, authenticated;

create or replace function rodizio_sugerido(p_match_id uuid)
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
declare m matches%rowtype;
begin
  select mm.* into m
    from matches mm
    join tournaments t on t.id = mm.tournament_id
   where mm.id = p_match_id
     and (t.publico or is_admin(auth.uid()));
  if m.id is null then return; end if;

  return query select * from rodizio_sugerido_interno(p_match_id);
end $$;

create or replace function resolver_rodizio(p_match_id uuid, p_aceitar boolean)
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

  -- A comparação pode produzir NULL quando arbitro_user_id está vazio. Tratar
  -- explicitamente como falso evita que o IF deixe passar um usuário estranho.
  if not (is_admin(uid)
          or coalesce(m.arbitro_user_id = uid, false)
          or coalesce(m.iniciada_por = uid, false)) then
    raise exception 'só quem conduziu esta partida pode decidir o rodízio';
  end if;

  if p_aceitar then
    select * into s from rodizio_sugerido_interno(p_match_id);
    if s.vai_player_id is null then
      raise exception 'não há rodízio a aplicar nesta partida';
    end if;

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
