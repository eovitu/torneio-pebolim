-- =============================================================================
-- O TROFÉU SAI NA HORA EM QUE A POSIÇÃO É DECIDIDA
--
-- Decisão do proprietário (27/08/2026): quem ganha a disputa de 3º lugar leva o
-- bronze naquele instante, sem esperar a final. Não faz sentido segurar uma
-- medalha já conquistada por causa de um jogo que ainda vai acontecer entre
-- outras duas equipes.
--
-- O QUE ESTAVA ERRADO
--
-- `conceder_trofeus` (20260826130000) começava com:
--
--     if not exists (... where posicao = 'CAMPEAO') then return 0; end if;
--
-- e `podio_do_mata_mata` só devolvia o TERCEIRO `where exists (select 1 from
-- campeao)`. As duas coisas juntas amarravam o bronze ao título: o 3º lugar
-- podia estar decidido há horas e nenhum troféu aparecia.
--
-- A dependência nunca foi real. Cada posição tem seu próprio critério:
--
--   TERCEIRO — decidida sozinha, pela disputa de 3º lugar;
--   CAMPEÃO  — decidida pela série da final (2 vitórias em até 3 jogos);
--   VICE     — sai junto do campeão, e só junto: o vice é "o outro finalista",
--              o que exige saber quem venceu. Essa dependência é genuína.
--
-- COMO A SINCRONIZAÇÃO PASSA A FUNCIONAR
--
-- Antes era apagar tudo e reinserir. Isso funcionava enquanto o pódio nascia
-- inteiro de uma vez; com a premiação incremental, reinserir zeraria o
-- `conquistado_em` do bronze toda vez que a final andasse — a medalha diria que
-- foi ganha depois do jogo que a decidiu.
--
-- Agora é um casamento: quem saiu do pódio perde o troféu, quem entrou ganha, e
-- quem já estava lá fica como está, com a data original preservada.
--
-- Pódio vazio não apaga nada. Sem isso, uma chave ainda indefinida limparia
-- troféus legítimos a cada partida encerrada.
-- =============================================================================

set search_path = public;

-- -----------------------------------------------------------------------------
-- O bronze deixa de depender do título.
-- -----------------------------------------------------------------------------
create or replace function podio_do_mata_mata(p_phase_id uuid)
returns table (posicao trofeu_posicao, team_id uuid)
language sql stable set search_path = public as $$
  with decididos as (
    select m.slot, m.team_a_id, m.team_b_id, s.gf_a, s.gf_b
      from matches m, lateral placar_partida(m.id) s
     where m.phase_id = p_phase_id
       and m.status = 'FINISHED'
       and m.slot in ('F1','F2','F3','T')
       -- Empate não decide nada: vai ao gol de ouro (§37).
       and s.gf_a <> s.gf_b
  ),
  vencedores as (
    select slot,
           case when gf_a > gf_b then team_a_id else team_b_id end as vencedor,
           case when gf_a > gf_b then team_b_id else team_a_id end as perdedor
      from decididos
  ),
  serie as (
    select vencedor, count(*) as vitorias
      from vencedores where slot in ('F1','F2','F3')
     group by vencedor
  ),
  campeao as (select vencedor from serie where vitorias >= 2 limit 1),
  -- O vice é o outro lado do primeiro jogo da final. Só existe com o campeão
  -- conhecido, e essa dependência é da própria definição de "vice".
  vice as (
    select case when v.vencedor = c.vencedor then v.perdedor else v.vencedor end as equipe
      from vencedores v cross join campeao c
     where v.slot = 'F1'
  )
  select 'CAMPEAO'::trofeu_posicao, vencedor from campeao
  union all
  select 'VICE'::trofeu_posicao, equipe from vice
  union all
  -- Sem `exists (campeao)`: o bronze é decidido pela própria disputa de 3º
  -- lugar e não deve nada à final.
  select 'TERCEIRO'::trofeu_posicao, v.vencedor
    from vencedores v where v.slot = 'T';
$$;

-- -----------------------------------------------------------------------------
-- Concede o que já está decidido, preservando o que já foi concedido.
-- -----------------------------------------------------------------------------
create or replace function conceder_trofeus(p_phase_id uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare f phases%rowtype; total int := 0;
begin
  select * into f from phases where id = p_phase_id;
  if f.id is null or f.kind <> 'KNOCKOUT' then return 0; end if;

  -- Nada decidido ainda: não conceder, e sobretudo não apagar. Uma chave em
  -- andamento passa por aqui a cada partida encerrada.
  if not exists (select 1 from podio_do_mata_mata(p_phase_id)) then
    return 0;
  end if;

  -- Saiu do pódio (um placar corrigido mudou o vencedor): perde o troféu.
  delete from trofeus t
   where t.tournament_id = f.tournament_id
     and not exists (
       select 1
         from podio_do_mata_mata(p_phase_id) p
         join team_players tp
           on tp.team_id = p.team_id and tp.tournament_id = f.tournament_id
        where tp.player_id = t.player_id);

  -- Entrou ou mudou de posição: ganha, ou tem a posição corrigida. Quem já
  -- estava com a mesma posição não é tocado, e mantém a data da conquista.
  insert into trofeus (tournament_id, team_id, player_id, posicao)
  select f.tournament_id, p.team_id, tp.player_id, p.posicao
    from podio_do_mata_mata(p_phase_id) p
    join team_players tp
      on tp.team_id = p.team_id and tp.tournament_id = f.tournament_id
  on conflict (tournament_id, player_id) do update
     set posicao = excluded.posicao,
         team_id = excluded.team_id
   where trofeus.posicao is distinct from excluded.posicao
      or trofeus.team_id is distinct from excluded.team_id;

  select count(*) into total from trofeus where tournament_id = f.tournament_id;

  perform registrar_auditoria(
    'CONCEDER_TROFEUS', 'phases', p_phase_id, f.tournament_id, null,
    jsonb_build_object('trofeus', total,
      'podio', (select jsonb_agg(jsonb_build_object('posicao', posicao, 'team_id', team_id)
                                 order by posicao)
                  from podio_do_mata_mata(p_phase_id))),
    'Pódio sincronizado: cada posição é premiada assim que é decidida');

  return total;
end $$;
