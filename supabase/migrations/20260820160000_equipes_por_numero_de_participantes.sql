-- =============================================================================
-- EQUIPES PELO NÚMERO DE PARTICIPANTES
--
-- Regra definida pelo proprietário em 20/08/2026, substituindo o formato de
-- número fixo. Motivo concreto: com duas contas era impossível gerar times,
-- porque `sortear_equipes` exigia EXATAMENTE
--   max_equipes × jogadores_por_equipe
-- jogadores. O torneio estava configurado em 3×2, então dois inscritos eram
-- recusados. Nada no banco impedia dois jogadores — a rigidez era só essa
-- exigência.
--
-- A regra nova:
--   - no máximo 2 pessoas por equipe;
--   - só vale formar duplas se sobrarem ao menos DUAS duplas; com menos que
--     isso o campeonato inteiro seria uma dupla contra um sozinho, então todo
--     mundo joga sozinho;
--   - número ímpar com duplas fechadas deixa uma equipe de 1, e isso é
--     permitido.
--
--   2 → [A] [B]                    3 → [A] [B] [C]
--   4 → [A+B] [C+D]                5 → [A+B] [C+D] [E]
--   6 → [A+B] [C+D] [E+F]          7 → [A+B] [C+D] [E+F] [G]
--
-- A fonte de verdade da regra é `comporEquipes` em packages/domain/src/teams.ts,
-- coberta por teste. O cálculo abaixo é o espelho dela: a interface não pode
-- ser a única a conhecer a regra (§45).
--
-- `max_equipes` e `jogadores_por_equipe` deixam de ser um alvo a atingir e
-- passam a ser o REGISTRO do que foi formado. Ficam preenchidos pelo sorteio.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Composição: quantas duplas e quantos sozinhos, para N participantes.
-- Espelha `comporEquipes`. `immutable` porque é aritmética pura.
-- -----------------------------------------------------------------------------
create function composicao_de_equipes(p_total int,
                                      out duplas int, out solos int, out equipes int)
language plpgsql immutable set search_path = public as $$
declare possiveis int;
begin
  if p_total < 2 then
    raise exception 'são necessários ao menos 2 participantes, recebeu %', p_total;
  end if;

  possiveis := p_total / 2;

  if possiveis < 2 then
    -- Uma dupla contra um sozinho seria o campeonato inteiro: todos sozinhos.
    duplas  := 0;
    solos   := p_total;
  else
    duplas  := possiveis;
    solos   := p_total % 2;
  end if;

  equipes := duplas + solos;
end $$;

revoke execute on function composicao_de_equipes(int) from public, anon;
grant  execute on function composicao_de_equipes(int) to authenticated;

-- -----------------------------------------------------------------------------
-- Sorteio, agora pelo número de inscritos.
--
-- Mantém tudo o que já valia: roda no SERVIDOR, com semente registrada em
-- auditoria, para que o resultado possa ser conferido e refeito depois.
--
-- Quando `p_player_ids` vem nulo, sorteia com TODOS os inscritos do torneio —
-- que é o caso normal agora que existe lista de inscrição.
-- -----------------------------------------------------------------------------
create or replace function sortear_equipes(
  p_tournament_id uuid,
  p_player_ids    uuid[] default null,
  p_nomes_equipes text[] default null,
  p_seed          double precision default null
) returns table (team_id uuid, equipe text, player_id uuid, jogador text)
language plpgsql security definer set search_path = public as $$
declare
  t            tournaments%rowtype;
  ids          uuid[];
  total        int;
  comp         record;
  semente      double precision;
  embaralhados uuid[];
  novo_time    uuid;
  nome_time    text;
  i            int;
  pos          int := 1;
  tamanho      int;
  j            int;
begin
  if not is_admin(auth.uid()) then
    raise exception 'somente administrador pode sortear as equipes';
  end if;

  select * into t from tournaments where id = p_tournament_id for update;
  if t.id is null then raise exception 'torneio inexistente'; end if;
  if t.status <> 'CONFIGURACAO' then
    raise exception 'o sorteio só acontece com o torneio em configuração (está em %)', t.status;
  end if;
  if exists (select 1 from teams where tournament_id = p_tournament_id) then
    raise exception 'este torneio já tem equipes formadas; remova-as antes de sortear de novo';
  end if;

  -- Sem lista explícita, entram todos os inscritos.
  if p_player_ids is null then
    select array_agg(tp.player_id) into ids
      from tournament_participants tp
     where tp.tournament_id = p_tournament_id;
  else
    ids := p_player_ids;
  end if;

  total := coalesce(array_length(ids, 1), 0);
  if total < 2 then
    raise exception 'são necessários ao menos 2 participantes para formar equipes, há %', total;
  end if;
  if (select count(distinct x) from unnest(ids) x) <> total then
    raise exception 'há jogadores repetidos na lista do sorteio';
  end if;
  if (select count(*) from players where id = any(ids)) <> total then
    raise exception 'algum jogador da lista não existe';
  end if;

  select * into comp from composicao_de_equipes(total);

  if p_nomes_equipes is not null
     and array_length(p_nomes_equipes, 1) <> comp.equipes then
    raise exception 'com % participantes formam-se % equipes; informe % nomes ou nenhum',
      total, comp.equipes, comp.equipes;
  end if;
  if p_seed is not null and (p_seed < -1 or p_seed > 1) then
    raise exception 'a semente precisa estar entre -1 e 1';
  end if;

  semente := coalesce(p_seed, random());
  perform setseed(semente);
  select array_agg(x order by random()) into embaralhados from unnest(ids) x;

  -- As duplas primeiro, depois quem sobrar sozinho.
  for i in 1 .. comp.equipes loop
    tamanho := case when i <= comp.duplas then 2 else 1 end;
    nome_time := coalesce(p_nomes_equipes[i], 'Equipe ' || i);

    insert into teams (tournament_id, nome) values (p_tournament_id, nome_time)
      returning id into novo_time;

    for j in 1 .. tamanho loop
      insert into team_players (team_id, player_id, tournament_id)
      values (novo_time, embaralhados[pos], p_tournament_id);
      pos := pos + 1;
    end loop;
  end loop;

  -- As colunas passam a REGISTRAR o que foi formado, em vez de exigir um alvo.
  -- `jogadores_por_equipe` guarda o MÁXIMO por equipe, que é o que a regra fixa.
  update tournaments
     set max_equipes          = comp.equipes,
         jogadores_por_equipe = case when comp.duplas > 0 then 2 else 1 end,
         updated_at           = now()
   where id = p_tournament_id;

  perform registrar_auditoria(
    p_acao          => 'SORTEAR_EQUIPES',
    p_entidade      => 'teams',
    p_entidade_id   => null,
    p_tournament_id => p_tournament_id,
    p_depois        => jsonb_build_object(
      'semente', semente,
      'participantes', total,
      'duplas', comp.duplas,
      'sozinhos', comp.solos,
      'ordem_sorteada', to_jsonb(embaralhados),
      'composicao', (
        select jsonb_agg(jsonb_build_object('equipe', e.nome,
                                            'jogadores', e.jogadores) order by e.nome)
          from (select tm.nome,
                       jsonb_agg(p.nome order by p.nome) as jogadores
                  from teams tm
                  join team_players tp on tp.team_id = tm.id
                  join players p on p.id = tp.player_id
                 where tm.tournament_id = p_tournament_id
                 group by tm.nome) e)));

  return query
    select tm.id, tm.nome, p.id, p.nome
      from teams tm
      join team_players tp on tp.team_id = tm.id
      join players p on p.id = tp.player_id
     where tm.tournament_id = p_tournament_id
     order by tm.nome, p.nome;
end $$;

-- -----------------------------------------------------------------------------
-- Desfazer o sorteio.
--
-- Antes, errar o sorteio exigia mexer no banco: a mensagem mandava "remova as
-- equipes antes de sortear de novo" e não existia nenhuma forma de fazer isso
-- pela aplicação. Com a composição derivada do número de inscritos, refazer
-- passou a ser rotina — chega mais um inscrito e a divisão inteira muda.
--
-- Só antes de existir qualquer partida: com partida existe histórico.
-- -----------------------------------------------------------------------------
create function desfazer_sorteio(p_tournament_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare t tournaments%rowtype; qtd int;
begin
  if not is_admin(auth.uid()) then
    raise exception 'somente administrador pode desfazer o sorteio';
  end if;

  select * into t from tournaments where id = p_tournament_id for update;
  if t.id is null then raise exception 'torneio inexistente'; end if;
  if t.status <> 'CONFIGURACAO' then
    raise exception 'o sorteio só pode ser desfeito com o torneio em configuração';
  end if;

  select count(*) into qtd from matches where tournament_id = p_tournament_id;
  if qtd > 0 then
    raise exception 'este torneio já tem % partida(s); o sorteio não pode ser desfeito', qtd;
  end if;

  perform registrar_auditoria(
    p_acao          => 'DESFAZER_SORTEIO',
    p_entidade      => 'teams',
    p_entidade_id   => null,
    p_tournament_id => p_tournament_id,
    p_antes         => (select jsonb_agg(jsonb_build_object('equipe', tm.nome))
                          from teams tm where tm.tournament_id = p_tournament_id),
    p_motivo        => 'Sorteio refeito');

  -- A inscrição NÃO é apagada: quem entrou continua inscrito para o próximo
  -- sorteio. Some apenas a divisão em equipes.
  delete from team_players where tournament_id = p_tournament_id;
  delete from teams        where tournament_id = p_tournament_id;
end $$;

revoke execute on function desfazer_sorteio(uuid) from public, anon;
grant  execute on function desfazer_sorteio(uuid) to authenticated;
