-- =============================================================================
-- Transição automática: fase de grupos encerrada → mata-mata (KNOCKOUT)
--
-- Decisão do proprietário (26/08/2026): ao encerrar uma fase de GRUPOS cuja
-- próxima fase (pela ordem) é um mata-mata simples ainda sem chaveamento, a
-- chave é gerada AUTOMATICAMENTE a partir da classificação. Só entram as N
-- melhores, com N sendo a maior potência de 2 menor ou igual ao número de
-- equipes do torneio (regra em `corte_de_mata_mata`). Quem fica fora do corte
-- está eliminado: sem chave, sem consolação, sem jogo nenhum.
--
-- Junto vem o TERCEIRO CRITÉRIO oficial de desempate, o CONFRONTO DIRETO,
-- espelhando `computeStandings` em packages/domain/src/standings.ts: entre as
-- equipes empatadas em pontos e saldo, vale a mini-tabela dos jogos delas entre
-- si — primeiro pontos, depois saldo. Não existe quarto critério: quem o
-- confronto direto também não separa continua empatado, e nesse caso a promoção
-- automática é PULADA e o administrador monta a chave na mão. Encerrar a fase
-- de grupos nunca fica bloqueado por causa disso.
--
-- A Copa (DOUBLE_ELIMINATION) passa a usar a mesma classificação, para que os
-- dois formatos promovam pelo mesmo critério.
-- =============================================================================

set search_path = public;

-- -----------------------------------------------------------------------------
-- Classificação de uma fase de grupos, com os três critérios oficiais.
--
-- `pos` vem de `rank()`: equipes que nenhum critério separa recebem a MESMA
-- posição — é assim que quem chama descobre que o empate ficou irresolvido.
-- -----------------------------------------------------------------------------
create or replace function classificacao_da_fase(p_phase_id uuid)
returns table (team_id uuid, pts int, saldo int, pos int)
language sql stable set search_path = public as $$
  with fase as (select tournament_id from phases where id = p_phase_id),
  resultados as (
    select m.team_a_id, m.team_b_id, s.gf_a, s.gf_b
      from matches m, lateral placar_partida(m.id) s
     where m.phase_id = p_phase_id and m.status = 'FINISHED'
  ),
  -- Cada jogo visto pelos dois lados: pontos e saldo daquela equipe naquele
  -- jogo, e contra quem ela jogou (o adversário é o que permite o confronto
  -- direto mais abaixo).
  lados as (
    select team_a_id as tid, team_b_id as adversario,
           case when gf_a > gf_b then 3 when gf_a = gf_b then 1 else 0 end as pts,
           gf_a - gf_b as saldo
      from resultados
    union all
    select team_b_id, team_a_id,
           case when gf_b > gf_a then 3 when gf_a = gf_b then 1 else 0 end,
           gf_b - gf_a
      from resultados
  ),
  agregado as (
    select tm.id as tid,
           coalesce(sum(l.pts), 0)::int   as pts,
           coalesce(sum(l.saldo), 0)::int as saldo
      from teams tm
      join fase on fase.tournament_id = tm.tournament_id
      left join lados l on l.tid = tm.id
     group by tm.id
  ),
  -- Confronto direto: contam SÓ os jogos contra equipes que terminaram com os
  -- mesmos pontos e o mesmo saldo. Jogos contra terceiros não entram.
  direto as (
    select l.tid,
           coalesce(sum(l.pts), 0)::int   as h_pts,
           coalesce(sum(l.saldo), 0)::int as h_saldo
      from lados l
      join agregado a on a.tid = l.tid
      join agregado b on b.tid = l.adversario
     where a.tid <> b.tid and a.pts = b.pts and a.saldo = b.saldo
     group by l.tid
  )
  select a.tid, a.pts, a.saldo,
         rank() over (order by a.pts desc, a.saldo desc,
                               coalesce(d.h_pts, 0) desc,
                               coalesce(d.h_saldo, 0) desc)::int
    from agregado a
    left join direto d on d.tid = a.tid
   order by a.pts desc, a.saldo desc,
            coalesce(d.h_pts, 0) desc, coalesce(d.h_saldo, 0) desc, a.tid;
$$;

-- -----------------------------------------------------------------------------
-- `encerrar_fase` promove automaticamente para a próxima fase.
--
-- Substitui a versão de 20260824240000, que só conhecia a Copa e só sabia
-- promover 4 equipes.
-- -----------------------------------------------------------------------------
create or replace function encerrar_fase(p_phase_id uuid)
returns phases
language plpgsql security definer set search_path to 'public' as $$
declare
  f          phases%rowtype;
  pendentes  int;
  proxima    phases%rowtype;
  inscritas  int;
  vagas      int;
  promovidos uuid[];
begin
  if not is_admin(auth.uid()) then
    raise exception 'somente administrador pode encerrar uma fase';
  end if;

  select * into f from phases where id = p_phase_id for update;
  if f.id is null then raise exception 'fase inexistente'; end if;
  if f.encerrada_em is not null then raise exception 'esta fase já foi encerrada'; end if;

  select count(*) into pendentes from matches
   where phase_id = p_phase_id and status <> 'FINISHED';
  if pendentes > 0 then
    raise exception 'ainda há % partida(s) não encerrada(s) nesta fase', pendentes;
  end if;
  if not exists (select 1 from matches where phase_id = p_phase_id) then
    raise exception 'esta fase não tem partidas';
  end if;

  update phases set encerrada_em = now() where id = p_phase_id returning * into f;

  perform registrar_auditoria('ENCERRAR_FASE', 'phases', f.id, f.tournament_id, null,
                              jsonb_build_object('nome', f.nome, 'encerrada_em', f.encerrada_em),
                              null);

  if f.kind <> 'GROUP' then return f; end if;

  select * into proxima from phases
   where tournament_id = f.tournament_id and ordem > f.ordem
   order by ordem asc limit 1;

  if proxima.id is null or proxima.chaveamento is not null then return f; end if;
  if exists (select 1 from matches where phase_id = proxima.id) then return f; end if;

  select count(*) into inscritas from teams where tournament_id = f.tournament_id;
  if inscritas < 2 then return f; end if;

  -- Quantos avançam: o corte por potência de 2 no mata-mata; os 4 melhores na
  -- Copa, como já era.
  vagas := case proxima.kind
             when 'KNOCKOUT'           then corte_de_mata_mata(inscritas)
             when 'DOUBLE_ELIMINATION' then 4
             else null end;
  if vagas is null then return f; end if;

  select array_agg(c.team_id order by c.pos, c.pts desc, c.saldo desc, c.team_id)
    into promovidos
    from classificacao_da_fase(p_phase_id) c
   where c.pos <= vagas;

  -- Só promove quando o corte está inequívoco. Um empate que atravessa a linha
  -- de corte infla o grupo além das vagas, e aí o administrador resolve na mão
  -- pela tela "Gerar a chave" — como já acontecia com a Copa.
  if coalesce(array_length(promovidos, 1), 0) <> vagas then return f; end if;

  if proxima.kind = 'KNOCKOUT' then
    perform gerar_mata_mata(proxima.id, promovidos);
  else
    perform gerar_eliminacao_dupla(proxima.id, promovidos);
  end if;

  return f;
end $$;

revoke execute on function classificacao_da_fase(uuid) from public, anon;
grant  execute on function classificacao_da_fase(uuid) to authenticated;
