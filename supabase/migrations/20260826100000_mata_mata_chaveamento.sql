-- =============================================================================
-- MATA-MATA SIMPLES (KNOCKOUT) — chaveamento automático
--
-- Mecânica confirmada pelo proprietário em 26/08/2026:
--
--   - ao encerrar a fase de grupos, o chaveamento sai AUTOMATICAMENTE da
--     classificação;
--   - só entram as N melhores, com N sendo a MAIOR potência de 2 MENOR OU IGUAL
--     ao número de equipes do torneio. Quem fica fora está eliminado: sem chave,
--     sem consolação, sem jogo nenhum;
--   - semeadura clássica: o melhor colocado pega o pior (1×4 e 2×3 na chave
--     de 4);
--   - havendo semifinal, os dois perdedores dela disputam o TERCEIRO LUGAR;
--   - a GRANDE FINAL é MELHOR DE 2 JOGOS. Os dois são sempre disputados, e se
--     cada equipe vencer um, uma TERCEIRA partida decide o título.
--
-- A fonte de verdade da regra é `packages/domain/src/mataMata.ts`, coberta por
-- teste. O que existe aqui é o espelho dela: a interface não pode ser a única a
-- conhecer o desenho da chave (§45).
--
-- Por que a terceira partida da final não tem regra própria de desempate: pelo
-- §37 partida de mata-mata não pode terminar empatada — empate no tempo
-- regulamentar vai ao Gol de Ouro. Logo a terceira partida sempre produz um
-- vencedor, e não há o que desempatar.
--
-- Diferença para a Copa: aqui NÃO existe bye. O corte deixa o número de
-- participantes exatamente igual ao tamanho da chave.
-- =============================================================================

set search_path = public;

-- -----------------------------------------------------------------------------
-- Corte: maior potência de 2 menor ou igual a n. Espelha `corteDeMataMata`.
-- -----------------------------------------------------------------------------
create or replace function corte_de_mata_mata(p_equipes int) returns int
language plpgsql immutable set search_path = public as $$
declare s int := 1;
begin
  if p_equipes < 2 then
    raise exception 'são necessárias ao menos 2 equipes para uma chave, recebeu %', p_equipes;
  end if;
  while s * 2 <= p_equipes loop s := s * 2; end loop;
  return s;
end $$;

-- -----------------------------------------------------------------------------
-- Desenho da chave. Espelha `montarMataMata`.
--
-- `ordem_de_chave` (da Copa) é reaproveitada: a ordem de semeadura é a mesma
-- clássica, e é ela que faz o 1º pegar o último e o 1º e o 2º só se encontrarem
-- na final.
-- -----------------------------------------------------------------------------
create or replace function montar_mata_mata(p_inscritas int) returns jsonb
language plpgsql immutable set search_path = public as $$
declare
  tamanho int;
  m       int;
  eliminatorias int;
  tem_terceiro boolean;
  ordem   int[];
  slots   jsonb := '[]'::jsonb;
  r int; p int; jogos int; faltam int;
  rotulo text;
  finalista_a jsonb;
  finalista_b jsonb;
begin
  tamanho := corte_de_mata_mata(p_inscritas);
  m := (ln(tamanho) / ln(2))::int;
  eliminatorias := m - 1;
  tem_terceiro := tamanho >= 4;
  ordem := ordem_de_chave(tamanho);

  -- rodadas eliminatórias (tudo que vem antes da final)
  for r in 1 .. eliminatorias loop
    jogos  := tamanho / (2 ^ r)::int;
    faltam := eliminatorias - r;
    rotulo := case faltam
                when 0 then 'Semifinal'
                when 1 then 'Quartas de final'
                when 2 then 'Oitavas de final'
                when 3 then 'Dezesseis avos de final'
                else r || 'ª rodada' end;
    for p in 1 .. jogos loop
      slots := slots || jsonb_build_object(
        'id', 'R' || r || '-' || p,
        'chave', 'ELIMINATORIA', 'rodada', r, 'posicao', p, 'rotulo', rotulo,
        'origem_a', case when r = 1
          then jsonb_build_object('tipo','EQUIPE','posicao', ordem[2*p-1])
          else jsonb_build_object('tipo','VENCEDOR','slot','R' || (r-1) || '-' || (2*p-1)) end,
        'origem_b', case when r = 1
          then jsonb_build_object('tipo','EQUIPE','posicao', ordem[2*p])
          else jsonb_build_object('tipo','VENCEDOR','slot','R' || (r-1) || '-' || (2*p)) end);
    end loop;
  end loop;

  -- Quem chega à final: os vencedores da semifinal, ou — em chave de 2 — as
  -- duas classificadas, que vão direto para a decisão.
  if eliminatorias = 0 then
    finalista_a := jsonb_build_object('tipo','EQUIPE','posicao',1);
    finalista_b := jsonb_build_object('tipo','EQUIPE','posicao',2);
  else
    finalista_a := jsonb_build_object('tipo','VENCEDOR','slot','R' || eliminatorias || '-1');
    finalista_b := jsonb_build_object('tipo','VENCEDOR','slot','R' || eliminatorias || '-2');
  end if;

  if tem_terceiro then
    slots := slots || jsonb_build_object(
      'id','T','chave','TERCEIRO_LUGAR','rodada', eliminatorias + 1,'posicao',1,
      'rotulo','Disputa de 3º lugar',
      'origem_a', jsonb_build_object('tipo','PERDEDOR','slot','R' || eliminatorias || '-1'),
      'origem_b', jsonb_build_object('tipo','PERDEDOR','slot','R' || eliminatorias || '-2'));
  end if;

  -- Grande final, melhor de 2. O segundo jogo inverte os lados.
  slots := slots || jsonb_build_object(
    'id','F1','chave','FINAL','rodada', eliminatorias + 1,'posicao',1,
    'rotulo','Final — jogo 1', 'origem_a', finalista_a, 'origem_b', finalista_b);
  slots := slots || jsonb_build_object(
    'id','F2','chave','FINAL','rodada', eliminatorias + 1,'posicao',2,
    'rotulo','Final — jogo 2', 'origem_a', finalista_b, 'origem_b', finalista_a);
  slots := slots || jsonb_build_object(
    'id','F3','chave','FINAL','rodada', eliminatorias + 1,'posicao',3,
    'rotulo','Final — jogo de desempate',
    'origem_a', jsonb_build_object('tipo','VENCEDOR','slot','F1'),
    'origem_b', jsonb_build_object('tipo','PERDEDOR','slot','F1'));

  return jsonb_build_object(
    'inscritas', p_inscritas,
    'tamanho_da_chave', tamanho,
    'rodadas_eliminatorias', eliminatorias,
    'tem_terceiro_lugar', tem_terceiro,
    'slots', slots);
end $$;

-- -----------------------------------------------------------------------------
-- Espelha `resolverMataMata`: percorre o plano, descobre quem ocupa cada
-- confronto e CRIA as partidas cujos dois lados já são conhecidos.
--
-- Idempotente de propósito: roda depois de cada partida encerrada sem criar
-- nada duas vezes — a unique (phase_id, slot) é a rede de segurança.
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

      -- O jogo 3 da final só existe com a série empatada em 1 a 1. Decidida a
      -- série em 2 a 0, ele é dispensado e nunca chega a ser criado.
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
      -- Sem bye no mata-mata simples: o corte deixa a chave exata. Um 'BYE' aqui
      -- só apareceria com chaveamento corrompido, e nesse caso não se cria nada.
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
      -- Empate não decide: mata-mata empatado vai para o Gol de Ouro, e
      -- enquanto não houver vencedor a chave não anda (§37).
      continue when gfa = gfb;

      venc := venc || jsonb_build_object(sid,
                case when gfa > gfb then part.team_a_id else part.team_b_id end);
      perd := perd || jsonb_build_object(sid,
                case when gfa > gfb then part.team_b_id else part.team_a_id end);
      mudou := true;
    end loop;

    exit when not mudou;
  end loop;

  return criadas;
end $$;

-- -----------------------------------------------------------------------------
-- Gera a chave de uma fase de mata-mata.
--
-- A ORDEM de `p_team_ids` É a classificação: a primeira da lista é o primeiro
-- colocado e ocupa a posição 1 de semeadura. O CORTE é aplicado aqui — passar 5
-- equipes gera uma chave de 4, e a 5ª não entra.
-- -----------------------------------------------------------------------------
create or replace function gerar_mata_mata(p_phase_id uuid, p_team_ids uuid[] default null)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  f       phases%rowtype;
  ids     uuid[];
  total   int;
  tamanho int;
  sem_elenco text;
  criadas int;
begin
  if not is_admin(auth.uid()) then
    raise exception 'somente administrador pode gerar o chaveamento';
  end if;

  select * into f from phases where id = p_phase_id for update;
  if f.id is null then raise exception 'fase inexistente'; end if;
  if f.kind <> 'KNOCKOUT' then
    raise exception 'esta fase não é de mata-mata';
  end if;
  if f.encerrada_em is not null then raise exception 'esta fase já foi encerrada'; end if;
  if f.chaveamento is not null then
    raise exception 'esta fase já tem chaveamento gerado';
  end if;
  if exists (select 1 from matches where phase_id = p_phase_id) then
    raise exception 'esta fase já tem partidas';
  end if;

  if p_team_ids is null then
    select array_agg(t.id order by lower(t.nome)) into ids
      from teams t where t.tournament_id = f.tournament_id;
  else
    ids := p_team_ids;
  end if;

  total := coalesce(array_length(ids, 1), 0);
  if total < 2 then
    raise exception 'são necessárias ao menos 2 equipes para uma chave, há %', total;
  end if;
  if (select count(distinct x) from unnest(ids) x) <> total then
    raise exception 'há equipes repetidas no chaveamento';
  end if;
  if (select count(*) from teams t
       where t.id = any(ids) and t.tournament_id = f.tournament_id) <> total then
    raise exception 'alguma equipe do chaveamento não é deste torneio';
  end if;

  -- O corte: só as `tamanho` primeiras entram. As demais estão eliminadas.
  tamanho := corte_de_mata_mata(total);
  ids := ids[1:tamanho];

  -- Sem elenco, a partida nasceria sem escalação e nenhum gol poderia ser
  -- registrado. Barrar aqui é o mesmo cuidado de `gerar_partidas_grupo`.
  select string_agg(tm.nome, ', ' order by tm.nome) into sem_elenco
    from teams tm
   where tm.id = any(ids)
     and not exists (select 1 from team_players tp where tp.team_id = tm.id);
  if sem_elenco is not null then
    raise exception 'estas equipes ainda estão sem jogadores: %', sem_elenco;
  end if;

  update phases
     set chaveamento = jsonb_build_object(
           'plano', montar_mata_mata(total),
           'ordem', to_jsonb(ids))
   where id = p_phase_id;

  criadas := avancar_mata_mata(p_phase_id);

  perform registrar_auditoria(
    p_acao          => 'GERAR_MATA_MATA',
    p_entidade      => 'phases',
    p_entidade_id   => p_phase_id,
    p_tournament_id => f.tournament_id,
    p_depois        => jsonb_build_object('inscritas', total, 'tamanho_da_chave', tamanho,
                                          'partidas_criadas', criadas,
                                          'chaveamento', to_jsonb(ids)),
    p_motivo        => 'Chave de mata-mata gerada');

  return criadas;
end $$;

-- -----------------------------------------------------------------------------
-- `encerrar_partida` passa a empurrar também a chave do mata-mata simples.
-- Só o trecho final mudou em relação a 20260820250001.
-- -----------------------------------------------------------------------------
create or replace function encerrar_partida(p_match_id uuid) returns matches
language plpgsql security definer set search_path = public as $$
declare m matches%rowtype; agora timestamptz := now(); a integer; b integer; destino match_status;
begin
  select * into m from matches where id = p_match_id for update;
  if m.status not in ('LIVE','PAUSED','GOLDEN_GOAL') then
    raise exception 'transição de partida inválida: % → FINISHED', m.status;
  end if;
  if not is_operador_da_partida(p_match_id, auth.uid()) then
    raise exception 'sem permissão para encerrar esta partida';
  end if;

  select gf_a, gf_b into a, b from placar_partida(p_match_id);

  if m.status = 'GOLDEN_GOAL' then
    destino := 'FINISHED';
  elsif m.phase_kind in ('KNOCKOUT','DOUBLE_ELIMINATION') and a = b then
    destino := 'GOLDEN_GOAL';
  else
    destino := 'FINISHED';
  end if;

  if destino = 'GOLDEN_GOAL' then
    update matches set status = 'GOLDEN_GOAL', status_antes_pausa = null,
           paused_at = null, updated_at = agora
     where id = p_match_id returning * into m;
    insert into match_events (match_id, type, clock_ms, created_by)
    values (p_match_id, 'GOLDEN_GOAL_STARTED', coalesce(elapsed_ms(m, agora), 0), auth.uid());
  else
    insert into match_events (match_id, type, clock_ms, created_by)
    values (p_match_id, 'MATCH_FINISHED', coalesce(elapsed_ms(m, agora), 0), auth.uid());
    update matches set status = 'FINISHED', finished_at = agora,
           status_antes_pausa = null, paused_at = null, updated_at = agora
     where id = p_match_id returning * into m;

    if m.slot is not null then
      if m.phase_kind = 'DOUBLE_ELIMINATION' then
        perform avancar_eliminacao_dupla(m.phase_id);
      elsif m.phase_kind = 'KNOCKOUT' then
        perform avancar_mata_mata(m.phase_id);
      end if;
    end if;
  end if;
  return m;
end $$;

-- -----------------------------------------------------------------------------
-- EXECUTE — funções de apoio não entram na API pública (§47).
-- -----------------------------------------------------------------------------
revoke execute on function corte_de_mata_mata(int) from public, anon, authenticated;

revoke execute on function montar_mata_mata(int) from public, anon;
grant  execute on function montar_mata_mata(int) to authenticated;
revoke execute on function avancar_mata_mata(uuid) from public, anon;
grant  execute on function avancar_mata_mata(uuid) to authenticated;
revoke execute on function gerar_mata_mata(uuid, uuid[]) from public, anon;
grant  execute on function gerar_mata_mata(uuid, uuid[]) to authenticated;
