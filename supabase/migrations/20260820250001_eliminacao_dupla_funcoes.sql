-- =============================================================================
-- ELIMINAÇÃO DUPLA — as funções
--
-- Continuação de 20260820250000. Ficou em arquivo separado porque
-- `alter type ... add value` não pode compartilhar transação com o uso do
-- valor novo: o enum precisa estar comitado antes.
--
-- A fonte de verdade da regra é `packages/domain/src/eliminacaoDupla.ts`,
-- coberta por teste. O que existe aqui é o espelho dela (§45).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Ordem clássica de chaveamento. Espelha `ordemDeChave`.
-- -----------------------------------------------------------------------------
create function ordem_de_chave(p_tamanho int) returns int[]
language plpgsql immutable set search_path = public as $$
declare ordem int[] := array[1,2]; nova int[]; total int; x int;
begin
  while array_length(ordem, 1) < p_tamanho loop
    total := array_length(ordem, 1) * 2 + 1;
    nova := '{}';
    foreach x in array ordem loop
      nova := nova || x || (total - x);
    end loop;
    ordem := nova;
  end loop;
  return ordem;
end $$;

-- -----------------------------------------------------------------------------
-- Desenho da chave. Espelha `montarEliminacaoDupla`.
--
-- A chave dos perdedores alterna rodadas: a ÍMPAR junta sobreviventes dela
-- mesma; a PAR seguinte junta quem sobreviveu com os recém-caídos da chave dos
-- vencedores. É essa alternância que faz cada equipe precisar de duas derrotas
-- para sair.
-- -----------------------------------------------------------------------------
create function montar_eliminacao_dupla(p_equipes int) returns jsonb
language plpgsql immutable set search_path = public as $$
declare
  tamanho int := 1;
  m       int;
  rodadas_perdedores int;
  ordem   int[];
  slots   jsonb := '[]'::jsonb;
  r int; p int; k int; jogos int; r_impar int; r_par int;
  rotulo text;
  faltam int;
  origem_perdedores jsonb;
begin
  if p_equipes < 2 then
    raise exception 'são necessárias ao menos 2 equipes para uma chave, recebeu %', p_equipes;
  end if;

  while tamanho < p_equipes loop tamanho := tamanho * 2; end loop;
  m := (ln(tamanho) / ln(2))::int;
  rodadas_perdedores := case when m = 1 then 1 else 2 * m - 2 end;
  ordem := ordem_de_chave(tamanho);

  -- chave dos vencedores
  for r in 1 .. m loop
    jogos := tamanho / (2 ^ r)::int;
    faltam := m - r;
    rotulo := case faltam
                when 0 then 'Decisão dos vencedores'
                when 1 then 'Semifinal dos vencedores'
                when 2 then 'Quartas dos vencedores'
                else 'Vencedores — ' || r || 'ª rodada' end;
    for p in 1 .. jogos loop
      slots := slots || jsonb_build_object(
        'id', 'V' || r || '-' || p,
        'chave', 'VENCEDORES', 'rodada', r, 'posicao', p, 'rotulo', rotulo,
        'origem_a', case when r = 1
          then jsonb_build_object('tipo','EQUIPE','posicao', ordem[2*p-1])
          else jsonb_build_object('tipo','VENCEDOR','slot','V' || (r-1) || '-' || (2*p-1)) end,
        'origem_b', case when r = 1
          then jsonb_build_object('tipo','EQUIPE','posicao', ordem[2*p])
          else jsonb_build_object('tipo','VENCEDOR','slot','V' || (r-1) || '-' || (2*p)) end);
    end loop;
  end loop;

  if m >= 2 then
    for k in 1 .. m - 1 loop
      jogos   := tamanho / (2 ^ (k + 1))::int;
      r_impar := 2 * k - 1;
      r_par   := 2 * k;

      for p in 1 .. jogos loop
        slots := slots || jsonb_build_object(
          'id', 'P' || r_impar || '-' || p,
          'chave', 'PERDEDORES', 'rodada', r_impar, 'posicao', p,
          'rotulo', 'Perdedores — ' || r_impar || 'ª rodada',
          'origem_a', case when k = 1
            then jsonb_build_object('tipo','PERDEDOR','slot','V1-' || (2*p-1))
            else jsonb_build_object('tipo','VENCEDOR','slot','P' || (2*k-2) || '-' || (2*p-1)) end,
          'origem_b', case when k = 1
            then jsonb_build_object('tipo','PERDEDOR','slot','V1-' || (2*p))
            else jsonb_build_object('tipo','VENCEDOR','slot','P' || (2*k-2) || '-' || (2*p)) end);
      end loop;

      for p in 1 .. jogos loop
        slots := slots || jsonb_build_object(
          'id', 'P' || r_par || '-' || p,
          'chave', 'PERDEDORES', 'rodada', r_par, 'posicao', p,
          'rotulo', case when r_par = rodadas_perdedores
                         then 'Decisão dos perdedores'
                         else 'Perdedores — ' || r_par || 'ª rodada' end,
          'origem_a', jsonb_build_object('tipo','VENCEDOR','slot','P' || r_impar || '-' || p),
          'origem_b', jsonb_build_object('tipo','PERDEDOR',
                        'slot','V' || (k+1) || '-' || (jogos - p + 1)));
      end loop;
    end loop;
  end if;

  origem_perdedores := case when m = 1
    then jsonb_build_object('tipo','PERDEDOR','slot','V1-1')
    else jsonb_build_object('tipo','VENCEDOR','slot','P' || rodadas_perdedores || '-1') end;

  slots := slots || jsonb_build_object(
    'id','F','chave','FINAL','rodada',1,'posicao',1,'rotulo','Final',
    'origem_a', jsonb_build_object('tipo','VENCEDOR','slot','V' || m || '-1'),
    'origem_b', origem_perdedores);

  slots := slots || jsonb_build_object(
    'id','FR','chave','FINAL_RESET','rodada',2,'posicao',1,
    'rotulo','Final — segunda decisão',
    'origem_a', jsonb_build_object('tipo','PERDEDOR','slot','F'),
    'origem_b', jsonb_build_object('tipo','VENCEDOR','slot','F'));

  return jsonb_build_object(
    'equipes', p_equipes,
    'tamanho_da_chave', tamanho,
    'rodadas_vencedores', m,
    'rodadas_perdedores', case when m = 1 then 0 else rodadas_perdedores end,
    'slots', slots);
end $$;

-- -----------------------------------------------------------------------------
-- Quem ocupa um lado de um confronto: a equipe daquela posição inicial, ou o
-- vencedor/perdedor de outro confronto. NULL = ainda não dá para saber;
-- 'BYE' = lado vazio da chave.
-- -----------------------------------------------------------------------------
create function ocupante_do_slot(p_origem jsonb, p_ordem jsonb,
                                 p_venc jsonb, p_perd jsonb)
returns text
language plpgsql immutable set search_path = public as $$
declare tipo text; alvo text; pos int;
begin
  tipo := p_origem->>'tipo';
  if tipo = 'EQUIPE' then
    pos := (p_origem->>'posicao')::int;
    -- Posição acima do número de equipes é bye: a chave é maior que a lista.
    if p_ordem->(pos - 1) is null then return 'BYE'; end if;
    return p_ordem->>(pos - 1);
  end if;

  alvo := p_origem->>'slot';
  if tipo = 'VENCEDOR' then
    if not (p_venc ? alvo) then return null; end if;
    return p_venc->>alvo;
  end if;
  if tipo = 'PERDEDOR' then
    if not (p_perd ? alvo) then return null; end if;
    return p_perd->>alvo;
  end if;
  raise exception 'origem de confronto desconhecida: %', tipo;
end $$;

-- -----------------------------------------------------------------------------
-- Espelha `resolverEliminacaoDupla`: percorre o plano, descobre quem ocupa cada
-- confronto e CRIA as partidas cujos dois lados já são conhecidos.
--
-- Idempotente de propósito: roda depois de cada partida encerrada sem criar
-- nada duas vezes — a unique (phase_id, slot) é a rede de segurança.
-- -----------------------------------------------------------------------------
create function avancar_eliminacao_dupla(p_phase_id uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare
  f        phases%rowtype;
  plano    jsonb;
  ordem    jsonb;
  slots    jsonb;
  venc     jsonb := '{}'::jsonb;
  perd     jsonb := '{}'::jsonb;
  ladoB    jsonb := '{}'::jsonb;
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
  if f.kind <> 'DOUBLE_ELIMINATION' then
    raise exception 'esta fase não é de eliminação dupla';
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

      a := ocupante_do_slot(confronto->'origem_a', ordem, venc, perd);
      b := ocupante_do_slot(confronto->'origem_b', ordem, venc, perd);

      -- A segunda final só existe se quem venceu a primeira veio da chave dos
      -- perdedores. Do contrário ela é dispensada e nunca chega a ser criada.
      if sid = 'FR' then
        if not (venc ? 'F') then continue; end if;
        if (venc->>'F') is distinct from (ladoB->>'F') then
          venc := venc || jsonb_build_object('FR', 'BYE');
          perd := perd || jsonb_build_object('FR', 'BYE');
          mudou := true;
          continue;
        end if;
      end if;

      continue when a is null or b is null;

      ladoB := ladoB || jsonb_build_object(sid, b);

      -- Bye: quem tem o par vazio passa sem jogar, e ninguém perdeu.
      if a = 'BYE' or b = 'BYE' then
        venc := venc || jsonb_build_object(sid, case when a = 'BYE' then b else a end);
        perd := perd || jsonb_build_object(sid, 'BYE');
        mudou := true;
        continue;
      end if;

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
-- Gera a chave de uma fase.
--
-- A ORDEM de `p_team_ids` E o chaveamento: a primeira equipe ocupa a posição 1.
-- Quem decide essa ordem é o administrador — o sistema não inventa critério de
-- semeadura (§67). Sem lista, a ordem é alfabética: determinística e sem
-- simular mérito.
-- -----------------------------------------------------------------------------
create function gerar_eliminacao_dupla(p_phase_id uuid, p_team_ids uuid[] default null)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  f      phases%rowtype;
  ids    uuid[];
  total  int;
  sem_elenco text;
  criadas int;
begin
  if not is_admin(auth.uid()) then
    raise exception 'somente administrador pode gerar o chaveamento';
  end if;

  select * into f from phases where id = p_phase_id for update;
  if f.id is null then raise exception 'fase inexistente'; end if;
  if f.kind <> 'DOUBLE_ELIMINATION' then
    raise exception 'esta fase não é de eliminação dupla';
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
           'plano', montar_eliminacao_dupla(total),
           'ordem', to_jsonb(ids))
   where id = p_phase_id;

  criadas := avancar_eliminacao_dupla(p_phase_id);

  perform registrar_auditoria(
    p_acao          => 'GERAR_ELIMINACAO_DUPLA',
    p_entidade      => 'phases',
    p_entidade_id   => p_phase_id,
    p_tournament_id => f.tournament_id,
    p_depois        => jsonb_build_object('equipes', total, 'partidas_criadas', criadas,
                                          'chaveamento', to_jsonb(ids)),
    p_motivo        => 'Chave de eliminação dupla gerada');

  return criadas;
end $$;

-- -----------------------------------------------------------------------------
-- `encerrar_partida` passa a empurrar a chave adiante. Só o trecho final mudou;
-- transição de estado, permissão e Gol de Ouro continuam como em
-- 20260819213759 — com DOUBLE_ELIMINATION entrando junto de KNOCKOUT na regra
-- do Gol de Ouro, porque as duas são mata-mata (§37).
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

    -- Encerrou um confronto da Copa: o vencedor segue na chave dos vencedores e
    -- o perdedor cai na dos perdedores. Quem calcula é o servidor, na hora.
    if m.phase_kind = 'DOUBLE_ELIMINATION' and m.slot is not null then
      perform avancar_eliminacao_dupla(m.phase_id);
    end if;
  end if;
  return m;
end $$;

-- Funções de apoio não entram na API pública (§47).
revoke execute on function ordem_de_chave(int) from public, anon, authenticated;
revoke execute on function ocupante_do_slot(jsonb, jsonb, jsonb, jsonb)
  from public, anon, authenticated;

revoke execute on function montar_eliminacao_dupla(int) from public, anon;
grant  execute on function montar_eliminacao_dupla(int) to authenticated;
revoke execute on function avancar_eliminacao_dupla(uuid) from public, anon;
grant  execute on function avancar_eliminacao_dupla(uuid) to authenticated;
revoke execute on function gerar_eliminacao_dupla(uuid, uuid[]) from public, anon;
grant  execute on function gerar_eliminacao_dupla(uuid, uuid[]) to authenticated;
