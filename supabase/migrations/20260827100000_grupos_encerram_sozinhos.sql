-- =============================================================================
-- A FASE DE GRUPOS SE ENCERRA SOZINHA
--
-- Decisão do proprietário (27/08/2026): quando a ÚLTIMA partida da fase de
-- grupos é encerrada, a fase se fecha sozinha e o chaveamento do mata-mata é
-- gerado na hora. O administrador não precisa mais clicar "Encerrar fase".
--
-- POR QUE ISTO NÃO CONTRADIZ MAIS A PREMISSA ORIGINAL
--
-- 20260820010000 dizia: «Não existe "todos os jogos acabaram, então gera o
-- chaveamento": isso exigiria fixar quantos avançam, como distribuir a chave e
-- como desempatar — regras que não estão definidas e que este código NÃO
-- inventa». O impedimento nunca foi a automação em si: era a ausência das três
-- regras. Elas foram definidas em 26/08/2026 e estão em
-- `packages/domain/src/mataMata.ts` — quantos avançam (`corteDeMataMata`), como
-- distribuir (`ordemDeSemeadura`) e como desempatar (confronto direto, em
-- `standings.ts`). Com as três fixadas e cobertas por teste, o sistema não
-- inventa mais nada ao avançar: ele aplica.
--
-- O QUE ACONTECE, EM ORDEM
--
--   1. a última partida de uma fase GROUP é encerrada;
--   2. a fase se fecha, com `encerrada_em` e registro em auditoria;
--   3. se a próxima fase existe e está vazia, a chave dela é gerada;
--   4. se NÃO existe próxima fase, uma fase de mata-mata é criada e a chave
--      dela é gerada. Sem isso "encerrar sozinho" pararia no meio do caminho.
--
-- O passo 4 respeita o que o administrador já montou: se ele criou uma próxima
-- fase — de qualquer tipo — nada é criado por cima dela.
--
-- QUANDO NADA ACONTECE, E ISSO É DE PROPÓSITO
--
-- A promoção continua sendo pulada quando o corte fica ambíguo (empate que
-- atravessa a linha de classificação). Nesse caso a FASE AINDA SE FECHA, e a
-- chave fica para o administrador montar na mão. Fechar não depende de
-- conseguir promover.
--
-- E se a geração falhar por qualquer motivo — uma equipe sem elenco, por
-- exemplo — o erro é registrado em auditoria e engolido. Encerrar uma partida
-- jamais pode falhar por causa do que vem depois dela: o juiz está com o
-- celular na mão, no meio do salão, e o placar já é real.
-- =============================================================================

set search_path = public;

-- -----------------------------------------------------------------------------
-- 1. GERADORES INTERNOS
--
-- `gerar_mata_mata` e `gerar_eliminacao_dupla` exigem administrador — correto
-- quando é o admin quem clica. Mas quem encerra a última partida dos grupos é o
-- JUIZ, que pode ser um jogador qualquer. Sem uma via interna, o encerramento
-- automático falharia justamente para quem está conduzindo o jogo.
--
-- Mesmo padrão já usado por `gerar_partidas_grupo_interno` e
-- `formar_equipes_interno`: o corpo vive na função interna, e a pública é a
-- casca que confere a permissão.
-- -----------------------------------------------------------------------------
create or replace function gerar_mata_mata_interno(
  p_phase_id uuid, p_team_ids uuid[] default null
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  f       phases%rowtype;
  ids     uuid[];
  total   int;
  tamanho int;
  sem_elenco text;
  criadas int;
begin
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

create or replace function gerar_mata_mata(p_phase_id uuid, p_team_ids uuid[] default null)
returns integer
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin(auth.uid()) then
    raise exception 'somente administrador pode gerar o chaveamento';
  end if;
  return gerar_mata_mata_interno(p_phase_id, p_team_ids);
end $$;

-- -----------------------------------------------------------------------------
-- 1b. ORDEM DOS CLASSIFICADOS
--
-- A posição vem dos três critérios oficiais. O que sobra depois deles precisa
-- de um desempate de ESTABILIDADE, só para a lista ser determinística — e ele
-- é o nome, o mesmo que `computeStandings` usa em standings.ts. Antes era o
-- uuid, que é aleatório, muda a cada torneio e não tem como ser explicado a
-- quem perguntar por que sua equipe pegou aquela adversária.
--
-- Isso NÃO é critério esportivo, e não deve ser apresentado como tal.
-- -----------------------------------------------------------------------------
create or replace function ordenar_classificados(p_phase_id uuid, p_vagas int)
returns uuid[]
language sql stable set search_path = public as $$
  select array_agg(c.team_id order by c.pos, c.pts desc, c.saldo desc, lower(tm.nome), c.team_id)
    from classificacao_da_fase(p_phase_id) c
    join teams tm on tm.id = c.team_id
   where c.pos <= p_vagas;
$$;

-- -----------------------------------------------------------------------------
-- 2. ENCERRAMENTO AUTOMÁTICO
--
-- Silenciosa de propósito: nunca levanta exceção. É chamada de dentro de
-- `encerrar_partida`, e o encerramento de uma partida não pode falhar por causa
-- do que vem depois dela.
-- -----------------------------------------------------------------------------
create or replace function encerrar_fase_se_completa(p_phase_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  f          phases%rowtype;
  proxima    phases%rowtype;
  inscritas  int;
  vagas      int;
  promovidos uuid[];
  criada     uuid;
  proxima_ordem smallint;
begin
  select * into f from phases where id = p_phase_id for update;
  if f.id is null or f.kind <> 'GROUP' or f.encerrada_em is not null then
    return false;
  end if;

  -- Ainda há jogo por disputar, ou a fase não tem jogo nenhum: nada a fazer.
  if exists (select 1 from matches where phase_id = p_phase_id and status <> 'FINISHED') then
    return false;
  end if;
  if not exists (select 1 from matches where phase_id = p_phase_id) then
    return false;
  end if;

  update phases set encerrada_em = now() where id = p_phase_id returning * into f;

  perform registrar_auditoria('ENCERRAR_FASE', 'phases', f.id, f.tournament_id, null,
    jsonb_build_object('nome', f.nome, 'encerrada_em', f.encerrada_em, 'automatico', true),
    'Última partida da fase de grupos encerrada: a fase se fechou sozinha');

  -- A partir daqui é promoção. Ela pode não acontecer, e a fase continua
  -- fechada de qualquer forma — fechar não depende de conseguir promover.
  begin
    select count(*) into inscritas from teams where tournament_id = f.tournament_id;
    if inscritas < 2 then return true; end if;

    select * into proxima from phases
     where tournament_id = f.tournament_id and ordem > f.ordem
     order by ordem asc limit 1;

    -- Sem próxima fase, o mata-mata é criado agora: sem isso, "encerrar
    -- sozinho" pararia no meio do caminho e ninguém veria chave nenhuma.
    if proxima.id is null then
      select coalesce(max(ordem), 0) + 1 into proxima_ordem
        from phases where tournament_id = f.tournament_id;
      insert into phases (tournament_id, kind, nome, ordem)
      values (f.tournament_id, 'KNOCKOUT', 'Mata-mata', proxima_ordem)
      returning id into criada;

      perform registrar_auditoria('CRIAR_FASE', 'phases', criada, f.tournament_id, null,
        jsonb_build_object('nome', 'Mata-mata', 'kind', 'KNOCKOUT', 'automatico', true),
        'Fase de mata-mata criada junto com o encerramento automático dos grupos');

      select * into proxima from phases where id = criada;
    end if;

    if proxima.chaveamento is not null then return true; end if;
    if exists (select 1 from matches where phase_id = proxima.id) then return true; end if;

    vagas := case proxima.kind
               when 'KNOCKOUT'           then corte_de_mata_mata(inscritas)
               when 'DOUBLE_ELIMINATION' then 4
               else null end;
    if vagas is null then return true; end if;

    promovidos := ordenar_classificados(p_phase_id, vagas);

    -- Corte ambíguo: o administrador monta a chave na mão, e a fase de grupos
    -- fica fechada do mesmo jeito.
    if coalesce(array_length(promovidos, 1), 0) <> vagas then return true; end if;

    if proxima.kind = 'KNOCKOUT' then
      perform gerar_mata_mata_interno(proxima.id, promovidos);
    else
      perform gerar_eliminacao_dupla(proxima.id, promovidos);
    end if;

  exception when others then
    -- Equipe sem elenco, chave impossível, o que for: o juiz não pode ficar
    -- preso por causa disso. Fica o rastro, e o admin gera a chave na mão.
    perform registrar_auditoria('FALHA_PROMOCAO_AUTOMATICA', 'phases', f.id, f.tournament_id,
      null, jsonb_build_object('erro', sqlerrm),
      'Fase de grupos encerrada, mas a chave não pôde ser gerada automaticamente');
  end;

  return true;
end $$;

-- -----------------------------------------------------------------------------
-- 3. `encerrar_partida` dispara o encerramento da fase
--
-- Só o bloco final mudou em relação a 20260826140000.
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

    -- Era a última partida dos grupos? Então a fase acabou, e o mata-mata começa.
    if m.phase_kind = 'GROUP' then
      perform encerrar_fase_se_completa(m.phase_id);
    end if;
  end if;
  return m;
end $$;

-- -----------------------------------------------------------------------------
-- 4. `registrar_gol` também fecha a fase, na condição por gols
--
-- Com a partida terminando por meta de gols, quem a encerra é `registrar_gol`,
-- não `encerrar_partida`. Sem isto, um torneio configurado por gols nunca veria
-- a fase de grupos se fechar sozinha. Só os dois blocos de encerramento
-- mudaram em relação a 20260826140000.
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

  insert into match_events (match_id, type, team_id, player_id, clock_ms, created_by)
  values (p_match_id, p_type, p_team_id, p_player_id,
          coalesce(elapsed_ms(m, agora), 0), auth.uid())
  returning * into ev;

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
    if m.phase_kind = 'GROUP' then perform encerrar_fase_se_completa(m.phase_id); end if;

  elsif m.status in ('LIVE','PAUSED') then
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
        if m.phase_kind = 'GROUP' then perform encerrar_fase_se_completa(m.phase_id); end if;
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
-- 4b. A VIA MANUAL VIRA CASCA
--
-- `encerrar_fase` continua existindo — o admin ainda pode fechar uma fase de
-- mata-mata, e ainda pode fechar os grupos antes do último jogo... não: a
-- guarda de pendentes segue valendo. O que muda é que, para GROUP, ela delega
-- ao mesmo caminho automático, em vez de manter uma segunda cópia da lógica de
-- promoção. Duas cópias divergem; esta é a razão de existir a delegação.
-- -----------------------------------------------------------------------------
create or replace function encerrar_fase(p_phase_id uuid) returns phases
language plpgsql security definer set search_path to 'public' as $$
declare f phases%rowtype; pendentes int;
begin
  if not is_admin(auth.uid()) then
    raise exception 'somente administrador pode encerrar uma fase';
  end if;

  select * into f from phases where id = p_phase_id for update;
  if f.id is null then raise exception 'fase inexistente'; end if;
  if f.encerrada_em is not null then raise exception 'esta fase já foi encerrada'; end if;

  select count(*) into pendentes from matches where phase_id = p_phase_id and status <> 'FINISHED';
  if pendentes > 0 then
    raise exception 'ainda há % partida(s) não encerrada(s) nesta fase', pendentes;
  end if;
  if not exists (select 1 from matches where phase_id = p_phase_id) then
    raise exception 'esta fase não tem partidas';
  end if;

  if f.kind = 'GROUP' then
    perform encerrar_fase_se_completa(p_phase_id);
    select * into f from phases where id = p_phase_id;
    return f;
  end if;

  update phases set encerrada_em = now() where id = p_phase_id returning * into f;
  perform registrar_auditoria('ENCERRAR_FASE', 'phases', f.id, f.tournament_id, null,
    jsonb_build_object('nome', f.nome, 'encerrada_em', f.encerrada_em), null);
  return f;
end $$;

-- -----------------------------------------------------------------------------
-- 5. REABRIR FASE — a válvula de escape
--
-- Encerrar deixou de ser um ato deliberado e virou consequência de apitar o
-- fim de um jogo. Isso muda o custo do engano: antes, fechar a fase cedo demais
-- exigia clicar num botão; agora acontece sozinho quando o último resultado
-- entra errado. E fase encerrada não deixa nenhuma partida dela começar.
--
-- `reabrir_fase` desfaz exatamente o que a automação fez, e nada além:
-- reabre a fase e, se a chave gerada em seguida ainda não teve nenhuma partida
-- iniciada, apaga essa chave junto. Se algum jogo do mata-mata já começou,
-- recusa — ali já existe história, e desmontar seria apagá-la.
-- -----------------------------------------------------------------------------
create or replace function reabrir_fase(p_phase_id uuid) returns phases
language plpgsql security definer set search_path = public as $$
declare f phases%rowtype; proxima phases%rowtype; apagadas int := 0;
begin
  if not is_admin(auth.uid()) then
    raise exception 'somente administrador pode reabrir uma fase';
  end if;

  select * into f from phases where id = p_phase_id for update;
  if f.id is null then raise exception 'fase inexistente'; end if;
  if f.encerrada_em is null then raise exception 'esta fase não está encerrada'; end if;

  select * into proxima from phases
   where tournament_id = f.tournament_id and ordem > f.ordem
   order by ordem asc limit 1;

  if proxima.id is not null and proxima.chaveamento is not null then
    if exists (select 1 from matches
                where phase_id = proxima.id and status <> 'SCHEDULED') then
      raise exception
        'a fase "%" já tem partida disputada: reabrir os grupos apagaria resultado real', proxima.nome;
    end if;

    delete from match_lineups where match_id in (select id from matches where phase_id = proxima.id);
    delete from match_events  where match_id in (select id from matches where phase_id = proxima.id);
    delete from matches where phase_id = proxima.id;
    get diagnostics apagadas = row_count;
    update phases set chaveamento = null where id = proxima.id;
  end if;

  update phases set encerrada_em = null where id = p_phase_id returning * into f;

  perform registrar_auditoria('REABRIR_FASE', 'phases', f.id, f.tournament_id,
    jsonb_build_object('encerrada_em', f.encerrada_em), 
    jsonb_build_object('nome', f.nome, 'chave_desfeita', apagadas),
    'Fase reaberta pelo administrador; a chave gerada em seguida foi desfeita');
  return f;
end $$;

revoke execute on function ordenar_classificados(uuid, int) from public, anon, authenticated;
revoke execute on function gerar_mata_mata_interno(uuid, uuid[]) from public, anon, authenticated;
revoke execute on function encerrar_fase_se_completa(uuid) from public, anon, authenticated;
revoke execute on function reabrir_fase(uuid) from public, anon;
grant  execute on function reabrir_fase(uuid) to authenticated;
