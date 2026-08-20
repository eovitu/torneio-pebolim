-- =============================================================================
-- CLUBES (TIMES QUE SOBREVIVEM AO TORNEIO) E MONTAGEM MANUAL DAS DUPLAS
--
-- Dois pedidos do proprietário (20/08/2026).
--
-- 1. MONTAR AS DUPLAS À MÃO
--    Até aqui só existia o sorteio. Passa a existir a escolha: sortear ou
--    montar. A regra de composição não muda — quem manda continua sendo
--    `comporEquipes`/`composicao_de_equipes` (§8): no máximo 2 por equipe, e o
--    número de duplas e de sozinhos é o que o número de inscritos determina. O
--    admin escolhe QUEM joga com QUEM, não QUANTOS times existem.
--
-- 2. TIME QUE EXISTE PARA SEMPRE
--    "Os Perversos" é o mesmo time em qualquer campeonato: mesmo nome, mesma
--    foto, mesma descrição, mesma dupla, e o histórico soma. `teams` continua
--    sendo a PARTICIPAÇÃO de um time em um torneio — é sobre ela que a
--    classificação e as partidas daquele campeonato se apoiam, e mexer nisso
--    quebraria tudo o que já existe. O que entra é o CLUBE: a identidade
--    persistente, com a qual cada participação se vincula.
--
--        clubs            identidade permanente (nome, foto, descrição, cor)
--          ^ club_id
--        teams            participação daquele clube em UM torneio
--
--    Com o vínculo, somar o histórico do clube é agrupar as participações —
--    nenhuma regra esportiva muda, e classificação e artilharia de cada
--    torneio continuam exatamente como estavam (§34, §35).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. O clube
-- -----------------------------------------------------------------------------
create table clubs (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null check (char_length(trim(nome)) between 1 and 40),
  descricao    text check (char_length(descricao) <= 280),
  logo_url     text,
  cor_primaria text check (cor_primaria ~ '^#[0-9a-fA-F]{6}$'),
  criado_por   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- A dupla permanente. O limite de 2 é a mesma regra das equipes (§8) e vive
-- em trigger porque constraint de tabela não conta linhas irmãs.
create table club_members (
  club_id    uuid not null references clubs(id) on delete cascade,
  player_id  uuid not null references players(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (club_id, player_id)
);
create index idx_club_members_player on club_members (player_id);

create function trg_limite_do_clube() returns trigger
language plpgsql security definer set search_path = public as $$
declare qtd int;
begin
  select count(*) into qtd from club_members where club_id = new.club_id;
  if qtd > 2 then
    raise exception 'um time tem no máximo 2 pessoas';
  end if;
  return null;
end $$;

create constraint trigger trg_90_limite_do_clube
  after insert on club_members
  deferrable initially deferred
  for each row execute function trg_limite_do_clube();

alter table teams add column club_id uuid references clubs(id) on delete set null;
create index idx_teams_club on teams (club_id);

-- Um clube não joga duas vezes o mesmo torneio.
create unique index uq_teams_club_por_torneio on teams (tournament_id, club_id)
  where club_id is not null;

create trigger trg_touch_clubs before update on clubs
  for each row execute function tocar_updated_at();

-- -----------------------------------------------------------------------------
-- 2. Leitura pública, escrita só pelas funções
--
-- Nome e foto de time já eram públicos; o clube não expõe nada novo. A escrita
-- passa toda por RPC com SECURITY DEFINER: não há grant de insert/update/delete
-- para o cliente, então não há caminho direto pela API (§47).
-- -----------------------------------------------------------------------------
alter table clubs        enable row level security;
alter table club_members enable row level security;

create policy clubs_select_publico on clubs for select
  to anon, authenticated using (true);
create policy club_members_select_publico on club_members for select
  to anon, authenticated using (true);

grant select on clubs, club_members to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. Guardar uma equipe do torneio como clube
--
-- Quem pode é quem já podia personalizar a equipe: o administrador ou quem
-- joga nela (§12). Guardar não muda nada no torneio corrente — só passa a
-- existir uma identidade reaproveitável.
-- -----------------------------------------------------------------------------
create function salvar_equipe_como_clube(p_team_id uuid) returns clubs
language plpgsql security definer set search_path = public as $$
declare e teams%rowtype; c clubs%rowtype;
begin
  select * into e from teams where id = p_team_id for update;
  if e.id is null then raise exception 'equipe inexistente'; end if;

  if not (is_admin(auth.uid())
          or exists (select 1 from team_players tp
                       join players p on p.id = tp.player_id
                      where tp.team_id = p_team_id and p.profile_id = auth.uid())) then
    raise exception 'só o administrador ou quem joga nesta equipe pode guardá-la';
  end if;

  if e.club_id is not null then
    select * into c from clubs where id = e.club_id;
    return c;
  end if;

  insert into clubs (nome, descricao, logo_url, cor_primaria, criado_por)
  values (e.nome, e.descricao, e.logo_url, e.cor_primaria, auth.uid())
  returning * into c;

  insert into club_members (club_id, player_id)
  select c.id, tp.player_id from team_players tp where tp.team_id = p_team_id;

  update teams set club_id = c.id, updated_at = now() where id = p_team_id;

  perform registrar_auditoria(
    p_acao          => 'GUARDAR_EQUIPE_COMO_CLUBE',
    p_entidade      => 'clubs',
    p_entidade_id   => c.id,
    p_tournament_id => e.tournament_id,
    p_depois        => jsonb_build_object('clube', c.nome, 'equipe_de_origem', e.id),
    p_motivo        => 'Time guardado para ser reaproveitado em outros torneios');

  return c;
end $$;

-- -----------------------------------------------------------------------------
-- 4. Personalizar a participação personaliza o clube
--
-- Sem isto, trocar o escudo no torneio deste mês não valeria para o próximo, e
-- a personalização se perderia — que é exatamente o que o proprietário pediu
-- para não acontecer. A policy de `teams` já decidiu quem podia chegar aqui.
-- -----------------------------------------------------------------------------
create function trg_sincronizar_clube() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.club_id is not null and (
       new.nome         is distinct from old.nome
    or new.descricao    is distinct from old.descricao
    or new.logo_url     is distinct from old.logo_url
    or new.cor_primaria is distinct from old.cor_primaria) then
    update clubs
       set nome         = new.nome,
           descricao    = new.descricao,
           logo_url     = coalesce(new.logo_url, logo_url),
           cor_primaria = new.cor_primaria
     where id = new.club_id;
  end if;
  return null;
end $$;

create trigger trg_70_sincronizar_clube
  after update on teams
  for each row execute function trg_sincronizar_clube();

-- -----------------------------------------------------------------------------
-- 5. Formação manual das equipes
--
-- `p_equipes` é uma lista, na ordem em que as equipes serão criadas:
--
--   [ { "nome": "Os Perversos", "club_id": "...", "jogadores": ["...","..."] },
--     { "jogadores": ["..."] } ]
--
-- `nome` e `club_id` são opcionais. Com `club_id`, a equipe nasce vinculada ao
-- clube e herda dele nome, descrição, escudo e cor — é assim que "jogar de
-- novo com o mesmo time" funciona.
--
-- As validações são as mesmas do sorteio, mais as que só a montagem manual
-- precisa: ninguém de fora da inscrição, ninguém em duas equipes, ninguém de
-- fora, e a FORMA da composição continua sendo a que o número de inscritos
-- determina (§8) — o admin escolhe as duplas, não quantas existem.
-- -----------------------------------------------------------------------------
create function formar_equipes_manual(p_tournament_id uuid, p_equipes jsonb)
returns table (team_id uuid, equipe text, player_id uuid, jogador text)
language plpgsql security definer set search_path = public as $$
declare
  t          tournaments%rowtype;
  comp       record;
  inscritos  uuid[];
  usados     uuid[] := '{}';
  item       jsonb;
  ids        uuid[];
  tamanhos   int[]  := '{}';
  esperados  int[]  := '{}';
  novo_time  uuid;
  nome_time  text;
  clube      clubs%rowtype;
  jid        uuid;
  i          int;
begin
  if not is_admin(auth.uid()) then
    raise exception 'somente administrador pode formar as equipes';
  end if;

  select * into t from tournaments where id = p_tournament_id for update;
  if t.id is null then raise exception 'torneio inexistente'; end if;
  if t.status <> 'CONFIGURACAO' then
    raise exception 'as equipes só são formadas com o torneio em configuração (está em %)', t.status;
  end if;
  if exists (select 1 from teams where tournament_id = p_tournament_id) then
    raise exception 'este torneio já tem equipes formadas; desfaça antes de montar de novo';
  end if;
  if jsonb_typeof(p_equipes) <> 'array' then
    raise exception 'a lista de equipes está malformada';
  end if;

  select array_agg(tp.player_id) into inscritos
    from tournament_participants tp where tp.tournament_id = p_tournament_id;

  select * into comp from composicao_de_equipes(coalesce(array_length(inscritos, 1), 0));

  -- Forma esperada: as duplas primeiro, depois quem joga sozinho.
  for i in 1 .. comp.duplas loop esperados := esperados || 2; end loop;
  for i in 1 .. comp.solos  loop esperados := esperados || 1; end loop;

  -- Primeira passagem: conferir a montagem inteira antes de criar qualquer coisa.
  for item in select * from jsonb_array_elements(p_equipes) loop
    select array_agg(value::uuid) into ids
      from jsonb_array_elements_text(coalesce(item->'jogadores', '[]'::jsonb));
    if ids is null or array_length(ids, 1) = 0 then
      raise exception 'há uma equipe sem ninguém';
    end if;
    tamanhos := tamanhos || array_length(ids, 1);
    foreach jid in array ids loop
      if not (jid = any(inscritos)) then
        raise exception 'há alguém na montagem que não está inscrito neste torneio';
      end if;
      if jid = any(usados) then
        raise exception 'a mesma pessoa aparece em duas equipes';
      end if;
      usados := usados || jid;
    end loop;
  end loop;

  if coalesce(array_length(usados, 1), 0) <> coalesce(array_length(inscritos, 1), 0) then
    raise exception 'todos os % inscritos precisam estar em alguma equipe; foram distribuídos %',
      coalesce(array_length(inscritos, 1), 0), coalesce(array_length(usados, 1), 0);
  end if;

  -- A forma é a que o número de inscritos determina — comparada ordenada, para
  -- que a ordem em que o admin montou não importe.
  if (select array_agg(x order by x desc) from unnest(tamanhos) x)
     is distinct from
     (select array_agg(x order by x desc) from unnest(esperados) x) then
    raise exception
      'com % inscritos formam-se % equipes (% dupla(s) e % sozinho(s)); a montagem enviada não bate',
      coalesce(array_length(inscritos, 1), 0), comp.equipes, comp.duplas, comp.solos;
  end if;

  -- Segunda passagem: criar.
  i := 0;
  for item in select * from jsonb_array_elements(p_equipes) loop
    i := i + 1;
    clube := null;
    if item ? 'club_id' and jsonb_typeof(item->'club_id') = 'string' then
      select * into clube from clubs where id = (item->>'club_id')::uuid;
      if clube.id is null then raise exception 'time guardado inexistente'; end if;
    end if;

    nome_time := coalesce(nullif(trim(coalesce(item->>'nome', '')), ''),
                          clube.nome,
                          'Equipe ' || i);

    insert into teams (tournament_id, nome, descricao, logo_url, cor_primaria, club_id)
    values (p_tournament_id, nome_time, clube.descricao, clube.logo_url,
            clube.cor_primaria, clube.id)
    returning id into novo_time;

    select array_agg(value::uuid) into ids
      from jsonb_array_elements_text(item->'jogadores');
    foreach jid in array ids loop
      insert into team_players (team_id, player_id, tournament_id)
      values (novo_time, jid, p_tournament_id);
    end loop;
  end loop;

  update tournaments
     set max_equipes          = comp.equipes,
         jogadores_por_equipe = case when comp.duplas > 0 then 2 else 1 end,
         updated_at           = now()
   where id = p_tournament_id;

  perform registrar_auditoria(
    p_acao          => 'MONTAR_EQUIPES_MANUALMENTE',
    p_entidade      => 'teams',
    p_entidade_id   => null,
    p_tournament_id => p_tournament_id,
    p_depois        => jsonb_build_object('participantes', coalesce(array_length(inscritos, 1), 0),
                                          'duplas', comp.duplas,
                                          'sozinhos', comp.solos,
                                          'montagem', p_equipes),
    p_motivo        => 'Equipes montadas à mão pelo administrador, sem sorteio');

  return query
    select tm.id, tm.nome, p.id, p.nome
      from teams tm
      join team_players tp on tp.team_id = tm.id
      join players p on p.id = tp.player_id
     where tm.tournament_id = p_tournament_id
     order by tm.nome, p.nome;
end $$;

revoke execute on function trg_limite_do_clube()   from public, anon, authenticated;
revoke execute on function trg_sincronizar_clube() from public, anon, authenticated;
revoke execute on function salvar_equipe_como_clube(uuid) from public, anon;
grant  execute on function salvar_equipe_como_clube(uuid) to authenticated;
revoke execute on function formar_equipes_manual(uuid, jsonb) from public, anon;
grant  execute on function formar_equipes_manual(uuid, jsonb) to authenticated;
