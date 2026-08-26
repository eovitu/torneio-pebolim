-- =============================================================================
-- TROFÉUS DO PÓDIO
--
-- Decisão do proprietário (26/08/2026): decidido o mata-mata, cada jogador das
-- equipes do pódio ganha um troféu no perfil, com o nome do torneio.
--
--   1º lugar — ouro, o destaque da tela;
--   2º lugar — prata, visivelmente abaixo do ouro;
--   3º lugar — bronze, o mais simples dos três;
--   4º em diante — nada.
--
-- Quem perde a disputa de 3º lugar não ganha troféu: ela decide o bronze, não
-- um quarto lugar premiado.
--
-- SKIN POR TORNEIO
--
-- Cada torneio pode ter um desenho diferente de troféu. O que o banco guarda é
-- só o NOME da skin escolhida pelo admin; o desenho (cores, ícone, textura)
-- vive na interface, que é onde ele pertence. O nome do torneio não é guardado
-- aqui: sai de `tournaments` na hora de mostrar, e assim renomear o torneio
-- corrige o troféu sozinho.
--
-- POR QUE UMA TABELA, E NÃO CÁLCULO NA HORA
--
-- O perfil de um jogador cruza todos os torneios que ele disputou. Recalcular o
-- pódio de cada um a cada abertura de perfil seria varrer o campeonato inteiro
-- para responder "quantas medalhas você tem". A tabela é o resultado
-- materializado — e é reescrita inteira a cada avanço da chave, então corrigir
-- um placar corrige o pódio junto.
-- =============================================================================

set search_path = public;

create type trofeu_posicao as enum ('CAMPEAO','VICE','TERCEIRO');

alter table tournaments
  add column trofeu_skin text not null default 'CLASSICO'
    check (trofeu_skin in ('CLASSICO','NEON','RETRO','BOTECO'));

create table trofeus (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid not null references tournaments(id) on delete restrict,
  team_id        uuid not null,
  player_id      uuid not null references players(id) on delete restrict,
  posicao        trofeu_posicao not null,
  conquistado_em timestamptz not null default now(),

  -- Um jogador não sobe duas vezes no mesmo pódio.
  unique (tournament_id, player_id),
  foreign key (team_id, tournament_id) references teams(id, tournament_id) on delete restrict
);

create index ix_trofeus_player on trofeus (player_id);

-- Leitura pública: o pódio é o que o campeonato tem de mais público. Escrita
-- só pelas funções, que rodam como definer (§47).
alter table trofeus enable row level security;
create policy trofeus_leitura on trofeus for select using (true);

-- -----------------------------------------------------------------------------
-- Pódio de uma fase de mata-mata, lido dos resultados. Espelha
-- `podioDoMataMata`: campeão é quem vence 2 dos até 3 jogos da final, vice é o
-- outro finalista, bronze sai da disputa de 3º lugar.
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
  -- O vice é o outro lado do primeiro jogo da final — sempre os dois finalistas.
  vice as (
    select case when v.vencedor = c.vencedor then v.perdedor else v.vencedor end as equipe
      from vencedores v cross join campeao c
     where v.slot = 'F1'
  )
  select 'CAMPEAO'::trofeu_posicao, vencedor from campeao
  union all
  select 'VICE'::trofeu_posicao, equipe from vice
  union all
  select 'TERCEIRO'::trofeu_posicao, v.vencedor
    from vencedores v
   where v.slot = 'T' and exists (select 1 from campeao);
$$;

-- -----------------------------------------------------------------------------
-- Materializa os troféus do torneio a partir do pódio da fase.
--
-- Reescreve tudo do zero de propósito: é o que faz corrigir um placar corrigir
-- também as medalhas, sem deixar troféu órfão de um resultado que mudou.
-- -----------------------------------------------------------------------------
create or replace function conceder_trofeus(p_phase_id uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare f phases%rowtype; concedidos int := 0;
begin
  select * into f from phases where id = p_phase_id;
  if f.id is null or f.kind <> 'KNOCKOUT' then return 0; end if;

  -- Sem campeão ainda, não há pódio: nada é concedido e nada é apagado.
  if not exists (select 1 from podio_do_mata_mata(p_phase_id) where posicao = 'CAMPEAO') then
    return 0;
  end if;

  delete from trofeus where tournament_id = f.tournament_id;

  insert into trofeus (tournament_id, team_id, player_id, posicao)
  select f.tournament_id, p.team_id, tp.player_id, p.posicao
    from podio_do_mata_mata(p_phase_id) p
    join team_players tp
      on tp.team_id = p.team_id and tp.tournament_id = f.tournament_id;
  get diagnostics concedidos = row_count;

  perform registrar_auditoria(
    'CONCEDER_TROFEUS', 'phases', p_phase_id, f.tournament_id, null,
    jsonb_build_object('trofeus', concedidos,
      'podio', (select jsonb_agg(jsonb_build_object('posicao', posicao, 'team_id', team_id))
                  from podio_do_mata_mata(p_phase_id))),
    'Pódio do mata-mata decidido');

  return concedidos;
end $$;

-- -----------------------------------------------------------------------------
-- Avançar a chave passa a conceder o pódio quando ele fica decidido.
-- Só o bloco final mudou em relação a 20260826100000.
-- -----------------------------------------------------------------------------
create or replace function avancar_mata_mata(p_phase_id uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare
  f        phases%rowtype;
  plano    jsonb;
  ordem    jsonb;
  slots    jsonb;
  venc     jsonb := '{}'::jsonb;
  perd     jsonb := '{}'::jsonb;
  confronto jsonb;
  sid      text;
  a        text;
  b        text;
  mudou    boolean;
  voltas   int := 0;
  criadas  int := 0;
  part     matches%rowtype;
  gfa int; gfb int;
  proxima_ordem int;
begin
  select * into f from phases where id = p_phase_id for update;
  if f.id is null then raise exception 'fase inexistente'; end if;
  if f.kind <> 'KNOCKOUT' then
    raise exception 'esta fase não é de mata-mata';
  end if;
  if f.chaveamento is null then
    raise exception 'o chaveamento desta fase ainda não foi gerado';
  end if;

  plano := f.chaveamento->'plano';
  ordem := f.chaveamento->'ordem';
  slots := plano->'slots';

  select coalesce(max(m.ordem), 0) into proxima_ordem
    from matches m where m.phase_id = p_phase_id;

  loop
    voltas := voltas + 1;
    exit when voltas > 64;
    mudou := false;

    for confronto in select * from jsonb_array_elements(slots) loop
      sid := confronto->>'id';
      continue when venc ? sid;

      if sid = 'F3' then
        if not (venc ? 'F1') or not (venc ? 'F2') then continue; end if;
        if (venc->>'F1') is not distinct from (venc->>'F2') then
          venc := venc || jsonb_build_object('F3', 'DISPENSADO');
          perd := perd || jsonb_build_object('F3', 'DISPENSADO');
          mudou := true;
          continue;
        end if;
      end if;

      a := ocupante_do_slot(confronto->'origem_a', ordem, venc, perd);
      b := ocupante_do_slot(confronto->'origem_b', ordem, venc, perd);
      continue when a is null or b is null or a = 'BYE' or b = 'BYE';

      select * into part from matches m where m.phase_id = p_phase_id and m.slot = sid;

      if part.id is null then
        proxima_ordem := proxima_ordem + 1;
        insert into matches (tournament_id, phase_id, phase_kind, label, ordem,
                             team_a_id, team_b_id, slot)
        values (f.tournament_id, f.id, f.kind, confronto->>'rotulo', proxima_ordem,
                a::uuid, b::uuid, sid);
        criadas := criadas + 1;
        mudou := true;
        continue;
      end if;

      continue when part.status <> 'FINISHED';

      select gf_a, gf_b into gfa, gfb from placar_partida(part.id);
      continue when gfa = gfb;

      venc := venc || jsonb_build_object(sid,
                case when gfa > gfb then part.team_a_id else part.team_b_id end);
      perd := perd || jsonb_build_object(sid,
                case when gfa > gfb then part.team_b_id else part.team_a_id end);
      mudou := true;
    end loop;

    exit when not mudou;
  end loop;

  -- Decidido o título, o pódio vira medalha no perfil de cada jogador.
  perform conceder_trofeus(p_phase_id);

  return criadas;
end $$;

revoke execute on function podio_do_mata_mata(uuid) from public, anon;
grant  execute on function podio_do_mata_mata(uuid) to authenticated;
revoke execute on function conceder_trofeus(uuid) from public, anon;
grant  execute on function conceder_trofeus(uuid) to authenticated;
