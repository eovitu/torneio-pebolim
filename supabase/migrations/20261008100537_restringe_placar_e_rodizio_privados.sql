-- Impede que RPCs SECURITY DEFINER exponham agregados ou escalações de
-- partidas em torneios privados a quem não é administrador.

-- O placar deve herdar os grants de leitura e as policies de matches e
-- match_events do chamador. Chamadas internas a partir de RPCs SECURITY
-- DEFINER autorizadas continuam usando o papel efetivo do invólucro.
create or replace function placar_partida(p_match_id uuid, out gf_a integer, out gf_b integer)
returns record
language plpgsql stable security invoker set search_path = public as $$
declare m matches%rowtype;
begin
  select * into m from matches where id = p_match_id;
  select
    coalesce(sum(e.goal_value) filter (where e.beneficiario = m.team_a_id), 0),
    coalesce(sum(e.goal_value) filter (where e.beneficiario = m.team_b_id), 0)
  into gf_a, gf_b
  from (
    select ev.goal_value,
           case when ev.type = 'OWN_GOAL'
                then case when ev.team_id = m.team_a_id then m.team_b_id else m.team_a_id end
                else ev.team_id end as beneficiario
      from match_events ev
     where ev.match_id = p_match_id
       and ev.type in ('NORMAL_GOAL','KEEPER_GOAL','OWN_GOAL')
       and not exists (select 1 from match_events r
                        where r.type = 'GOAL_REMOVED' and r.removed_event_id = ev.id)
  ) e;
end $$;

-- Este invólucro ainda precisa consultar os auxiliares privilegiados de
-- rodízio. Mantemos SECURITY DEFINER, mas só calculamos/devolvemos roster
-- após aplicar a mesma fronteira pública ou administrador usada pelas
-- policies das tabelas subjacentes.
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
declare
  m           matches%rowtype;
  gf_a int; gf_b int;
  v_perdedora uuid;
  v_solitaria uuid;
  v_solitario uuid;
begin
  select mm.* into m
    from matches mm
    join tournaments t on t.id = mm.tournament_id
   where mm.id = p_match_id
     and (t.publico or is_admin(auth.uid()));
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

  -- Quem perdeu foi o próprio solitário: não há quem emprestar.
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
