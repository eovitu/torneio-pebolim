-- =============================================================================
-- torneio-pebolim — schema inicial
-- Projeto Supabase: fgbpeuanyoefjcywhvkh
--
-- Princípios aplicados (CLAUDE.md):
--   §30/§51 o placar NUNCA é armazenado: é derivado dos eventos.
--   §52     `seq` é atribuído pelo banco, jamais pelo cliente.
--   §53     o relógio é derivado de timestamps do SERVIDOR.
--   §29     match_events é append-only: nada é apagado, nem por admin.
--   §45/§47 autorização vive em RLS + funções, nunca só no frontend.
-- =============================================================================

set search_path = public;

-- -----------------------------------------------------------------------------
-- 1. ENUMS — espelham packages/domain/src/types.ts
-- -----------------------------------------------------------------------------
create type match_status      as enum ('SCHEDULED','LIVE','PAUSED','GOLDEN_GOAL','FINISHED');
create type phase_kind        as enum ('GROUP','KNOCKOUT');
create type app_role          as enum ('PLAYER','ADMIN','FACTORY_ADMIN');
create type tournament_status as enum ('CONFIGURACAO','AGUARDANDO_INICIO','EM_ANDAMENTO','ENCERRADO');
create type match_event_type  as enum (
  'NORMAL_GOAL','KEEPER_GOAL','OWN_GOAL','GOAL_REMOVED',
  'MATCH_STARTED','MATCH_PAUSED','MATCH_RESUMED','GOLDEN_GOAL_STARTED','MATCH_FINISHED');

-- -----------------------------------------------------------------------------
-- 2. CONFIGURAÇÃO DE BOOTSTRAP
--
-- O admin de fábrica é identificado por configuração de servidor, nunca por um
-- campo que o frontend possa manipular (§11). Guardado em tabela em vez de
-- `ALTER DATABASE ... SET` porque o valor precisa sobreviver a restore, branch
-- e reset.
--
-- O e-mail real NÃO é versionado: este repositório é público, e o endereço do
-- proprietário é dado pessoal. A migration grava um marcador, e o valor real é
-- aplicado direto no banco, fora do controle de versão:
--
--   update app_config set valor = '<email-do-proprietario>', updated_at = now()
--    where chave = 'factory_admin_email';
--
-- Enquanto o marcador estiver no lugar, nenhum cadastro recebe FACTORY_ADMIN:
-- `handle_new_user` compara o e-mail do novo usuário com este valor, e o
-- marcador não é um e-mail válido — então a comparação simplesmente nunca
-- casa. Um banco recriado do zero fica sem administrador de fábrica até que o
-- UPDATE acima seja executado, o que é o comportamento seguro.
-- -----------------------------------------------------------------------------
create table app_config (
  chave      text primary key,
  valor      text not null,
  updated_at timestamptz not null default now()
);
alter table app_config enable row level security;
-- Nenhuma policy: invisível e imutável para anon e authenticated.
-- Só funções SECURITY DEFINER leem esta tabela.

insert into app_config (chave, valor)
values ('factory_admin_email', 'CONFIGURAR_NO_BANCO');

-- -----------------------------------------------------------------------------
-- 3. PERFIS E PAPÉIS
-- -----------------------------------------------------------------------------
create table profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  nome            text not null check (char_length(trim(nome)) between 2 and 60),
  avatar_url      text,
  data_nascimento date check (data_nascimento is null
                              or data_nascimento between '1900-01-01' and current_date),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table user_roles (
  user_id       uuid not null references auth.users(id) on delete cascade,
  role          app_role not null,
  concedido_por uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  primary key (user_id, role)
);
create index idx_user_roles_role on user_roles (role);

-- Perfil e papel de fábrica nascem no signup — o cliente nunca insere nenhum
-- dos dois. FACTORY_ADMIN só é concedido aqui, ao e-mail configurado.
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare email_fabrica text;
begin
  insert into profiles (id, nome)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data->>'nome'), ''),
                           split_part(new.email, '@', 1)));

  insert into user_roles (user_id, role) values (new.id, 'PLAYER');

  select valor into email_fabrica from app_config where chave = 'factory_admin_email';
  if email_fabrica is not null and lower(new.email) = lower(email_fabrica) then
    insert into user_roles (user_id, role) values (new.id, 'FACTORY_ADMIN');
  end if;

  return new;
end $$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Protege o último admin de fábrica de ser removido, inclusive por ele mesmo.
create function guardar_factory_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.role = 'FACTORY_ADMIN'
     and (select count(*) from user_roles where role = 'FACTORY_ADMIN') <= 1 then
    raise exception 'não é possível remover o último administrador de fábrica';
  end if;
  return old;
end $$;

create trigger trg_guardar_factory_admin
  before delete on user_roles
  for each row execute function guardar_factory_admin();

-- -----------------------------------------------------------------------------
-- 4. FUNÇÕES DE AUTORIZAÇÃO
--
-- Todas SECURITY DEFINER + search_path fixo: contornam RLS de propósito, para
-- que uma policy possa consultá-las sem recursão infinita.
-- -----------------------------------------------------------------------------
create function is_admin(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles
                 where user_id = uid and role in ('ADMIN','FACTORY_ADMIN'));
$$;

create function is_factory_admin(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = uid and role = 'FACTORY_ADMIN');
$$;

-- -----------------------------------------------------------------------------
-- 5. JOGADORES
--
-- Um jogador existe SEM conta: o admin cadastra os participantes e cada um
-- vincula um profile depois, se quiser. Conta só é exigida para OPERAR.
-- -----------------------------------------------------------------------------
create table players (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid unique references profiles(id) on delete set null,
  nome       text not null check (char_length(trim(nome)) between 2 and 60),
  foto_url   text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_players_profile on players (profile_id) where profile_id is not null;

-- -----------------------------------------------------------------------------
-- 6. TORNEIOS
-- -----------------------------------------------------------------------------
create table tournaments (
  id                   uuid primary key default gen_random_uuid(),
  nome                 text not null check (char_length(trim(nome)) between 2 and 80),
  slug                 text not null check (slug ~ '^[a-z0-9][a-z0-9-]{1,60}$'),
  status               tournament_status not null default 'CONFIGURACAO',
  publico              boolean not null default true,
  -- Defaults do primeiro campeonato (§13). São DEFAULT, não regra: o admin
  -- altera livremente. Nada no schema fixa 4 equipes de 2 jogadores.
  max_equipes          smallint not null default 4 check (max_equipes >= 2),
  jogadores_por_equipe smallint not null default 2 check (jogadores_por_equipe >= 1),
  rules_version        text not null,
  criado_por           uuid not null references auth.users(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create unique index uq_tournaments_slug on tournaments (lower(slug));
create index idx_tournaments_status on tournaments (status);

-- -----------------------------------------------------------------------------
-- 7. EQUIPES — pertencem a UM torneio; cada torneio recria as suas
-- -----------------------------------------------------------------------------
create table teams (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete restrict,
  nome          text not null check (char_length(trim(nome)) between 1 and 60),
  descricao     text,
  logo_url      text,
  cor_primaria  text check (cor_primaria ~ '^#[0-9a-fA-F]{6}$'),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- Âncora para FKs compostas: garante que tudo que referencia uma equipe
  -- referencie também o MESMO torneio.
  unique (id, tournament_id)
);
create unique index uq_teams_nome_por_torneio on teams (tournament_id, lower(nome));

-- -----------------------------------------------------------------------------
-- 8. ELENCO
--
-- `tournament_id` é denormalizado só para viabilizar a exclusividade: um
-- jogador não pode estar em duas equipes do mesmo torneio. Entre torneios
-- diferentes, sem restrição. O trigger preenche o campo — o cliente não.
-- -----------------------------------------------------------------------------
create table team_players (
  team_id       uuid not null,
  player_id     uuid not null references players(id) on delete restrict,
  tournament_id uuid not null,
  -- Informativo/visual apenas. NÃO restringe quem pode receber KEEPER_GOAL:
  -- o tipo do gol é declarado pelo juiz (rules.ts), não inferido da posição.
  goleiro       boolean not null default false,
  created_at    timestamptz not null default now(),
  primary key (team_id, player_id),
  foreign key (team_id, tournament_id) references teams(id, tournament_id) on delete cascade,
  unique (tournament_id, player_id)
);
create index idx_team_players_player on team_players (player_id);

create function preencher_tournament_id_elenco() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select tournament_id into new.tournament_id from teams where id = new.team_id;
  if new.tournament_id is null then
    raise exception 'equipe % inexistente', new.team_id;
  end if;
  return new;
end $$;

create trigger trg_10_elenco_torneio
  before insert or update on team_players
  for each row execute function preencher_tournament_id_elenco();

-- -----------------------------------------------------------------------------
-- 9. FASES — formato totalmente configurável (§15)
-- -----------------------------------------------------------------------------
create table phases (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete restrict,
  kind          phase_kind not null,
  nome          text not null check (char_length(trim(nome)) between 1 and 60),
  ordem         smallint not null check (ordem >= 1),
  created_at    timestamptz not null default now(),
  unique (tournament_id, ordem),
  -- Âncora da FK composta de matches: amarra fase, torneio e tipo de fase.
  unique (id, tournament_id, kind)
);

-- -----------------------------------------------------------------------------
-- 10. PARTIDAS
--
-- Colunas de relógio batem 1:1 com MatchClock (clock.ts). Todas escritas com
-- now() do SERVIDOR, dentro das RPCs — nunca com timestamp vindo do cliente.
-- -----------------------------------------------------------------------------
create table matches (
  id                    uuid primary key default gen_random_uuid(),
  tournament_id         uuid not null references tournaments(id) on delete restrict,
  phase_id              uuid not null,
  phase_kind            phase_kind not null,
  label                 text not null,
  ordem                 smallint not null check (ordem >= 1),
  team_a_id             uuid not null,
  team_b_id             uuid not null,
  status                match_status not null default 'SCHEDULED',
  -- Estado ao qual retomar devolve a partida. Uma pausa durante o gol de ouro
  -- volta ao gol de ouro, nunca ao tempo regulamentar (statusAfterResume).
  status_antes_pausa    match_status,
  agendada_para         timestamptz,
  arbitro_user_id       uuid references auth.users(id) on delete set null,
  iniciada_por          uuid references auth.users(id) on delete set null,
  started_at            timestamptz,
  paused_at             timestamptz,
  accumulated_paused_ms integer not null default 0 check (accumulated_paused_ms >= 0),
  finished_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint ck_times_distintos check (team_a_id <> team_b_id),

  -- A fase é do mesmo torneio E o phase_kind da partida é o da fase. Sem isto,
  -- statusAtRegulationEnd decidiria o gol de ouro com um dado mentiroso.
  foreign key (phase_id, tournament_id, phase_kind)
    references phases(id, tournament_id, kind) on delete restrict,
  -- Ambas as equipes são do mesmo torneio da partida.
  foreign key (team_a_id, tournament_id) references teams(id, tournament_id) on delete restrict,
  foreign key (team_b_id, tournament_id) references teams(id, tournament_id) on delete restrict,

  -- Coerência do relógio com o estado
  constraint ck_agendada    check (status <> 'SCHEDULED' or (started_at is null and finished_at is null)),
  constraint ck_encerrada   check (status <> 'FINISHED' or finished_at is not null),
  constraint ck_pausa       check ((status = 'PAUSED') = (paused_at is not null)),
  constraint ck_antes_pausa check ((status = 'PAUSED') = (status_antes_pausa is not null)),
  constraint ck_retomada    check (status_antes_pausa is null
                                   or status_antes_pausa in ('LIVE','GOLDEN_GOAL')),
  constraint ck_inicio      check (finished_at is null or started_at is not null)
);
create unique index uq_matches_ordem on matches (phase_id, ordem);
create index idx_matches_torneio_status on matches (tournament_id, status);
create index idx_matches_fase on matches (phase_id);
create index idx_matches_agenda on matches (tournament_id, agendada_para);
create index idx_matches_ao_vivo on matches (tournament_id)
  where status in ('LIVE','PAUSED','GOLDEN_GOAL');

-- 10.1 `label` gerado da fase + ordem quando não informado; o admin sobrescreve
-- depois com um UPDATE comum ("Semifinal 1", "Grande Final"...).
create function gerar_label_partida() returns trigger
language plpgsql security definer set search_path = public as $$
declare nome_fase text;
begin
  if new.label is null or trim(new.label) = '' then
    select nome into nome_fase from phases where id = new.phase_id;
    new.label := nome_fase || ' — Jogo ' || new.ordem;
  end if;
  return new;
end $$;

create trigger trg_05_gerar_label
  before insert on matches
  for each row execute function gerar_label_partida();

-- -----------------------------------------------------------------------------
-- 11. ESCALAÇÃO — espelha lineupA/lineupB de MatchWithEvents
-- -----------------------------------------------------------------------------
create table match_lineups (
  match_id   uuid not null references matches(id) on delete cascade,
  team_id    uuid not null references teams(id) on delete restrict,
  player_id  uuid not null references players(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (match_id, player_id)
);
create index idx_lineups_match_team on match_lineups (match_id, team_id);

-- Escalação = elenco inteiro da equipe. Preenchida automaticamente ao criar a
-- partida e ressincronizada enquanto ela ainda está SCHEDULED.
create function sincronizar_escalacao(p_match_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from match_lineups where match_id = p_match_id;
  insert into match_lineups (match_id, team_id, player_id)
  select m.id, tp.team_id, tp.player_id
    from matches m
    join team_players tp on tp.team_id in (m.team_a_id, m.team_b_id)
   where m.id = p_match_id;
end $$;

create function trg_escalar_nova_partida() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform sincronizar_escalacao(new.id);
  return new;
end $$;

create trigger trg_20_escalar_partida
  after insert on matches
  for each row execute function trg_escalar_nova_partida();

create function trg_ressincronizar_escalacoes() returns trigger
language plpgsql security definer set search_path = public as $$
declare m uuid; alvo uuid;
begin
  -- NEW não existe em DELETE (e OLD não existe em INSERT): ler o campo errado
  -- aborta o trigger com "record is not assigned yet".
  alvo := case when tg_op = 'DELETE' then old.team_id else new.team_id end;
  for m in select id from matches
            where status = 'SCHEDULED' and alvo in (team_a_id, team_b_id)
  loop
    perform sincronizar_escalacao(m);
  end loop;
  return null;
end $$;

create trigger trg_30_ressincronizar_escalacoes
  after insert or delete on team_players
  for each row execute function trg_ressincronizar_escalacoes();

-- -----------------------------------------------------------------------------
-- 12. EVENTOS DA PARTIDA — a fonte de verdade de tudo
-- -----------------------------------------------------------------------------
create table match_events (
  id               uuid primary key default gen_random_uuid(),
  match_id         uuid not null references matches(id) on delete restrict,
  -- SEMPRE sobrescrito pelo trigger. O valor enviado pelo cliente é descartado.
  seq              integer not null,
  type             match_event_type not null,
  team_id          uuid references teams(id) on delete restrict,
  player_id        uuid references players(id) on delete restrict,
  clock_ms         integer not null check (clock_ms >= 0),
  removed_event_id uuid references match_events(id) on delete restrict,
  reason           text,
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),

  -- O valor do gol é DERIVADO do tipo, nunca informado. Não existe campo em
  -- que se possa gravar 2 num gol contra: o Postgres rejeita qualquer INSERT
  -- que tente escrever esta coluna. Espelha GOAL_VALUE de types.ts.
  goal_value smallint generated always as (
    case type
      when 'KEEPER_GOAL'::match_event_type then 2::smallint
      when 'NORMAL_GOAL'::match_event_type then 1::smallint
      when 'OWN_GOAL'::match_event_type    then 1::smallint
      else null
    end
  ) stored,

  constraint uq_match_seq     unique (match_id, seq),
  -- Um gol não pode ser removido duas vezes.
  constraint uq_remocao_unica unique (removed_event_id),

  constraint ck_gol check (
    type not in ('NORMAL_GOAL','KEEPER_GOAL','OWN_GOAL')
    or (team_id is not null and player_id is not null and removed_event_id is null)),
  constraint ck_remocao check (
    type <> 'GOAL_REMOVED'
    or (removed_event_id is not null and team_id is null and player_id is null)),
  constraint ck_ciclo_vida check (
    type not in ('MATCH_STARTED','MATCH_PAUSED','MATCH_RESUMED','GOLDEN_GOAL_STARTED','MATCH_FINISHED')
    or (team_id is null and player_id is null and removed_event_id is null))
);
create index idx_events_match_seq on match_events (match_id, seq);
create index idx_events_match_created on match_events (match_id, created_at);
create index idx_events_player on match_events (player_id)
  where type in ('NORMAL_GOAL','KEEPER_GOAL','OWN_GOAL');
create index idx_events_removido on match_events (removed_event_id)
  where removed_event_id is not null;

-- 12.1 seq monotônico atribuído pelo banco (§52)
create function atribuir_seq() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Trava a linha da partida: serializa dois juízes clicando no mesmo instante.
  perform 1 from matches where id = new.match_id for update;
  select coalesce(max(seq), 0) + 1 into new.seq
    from match_events where match_id = new.match_id;
  return new;
end $$;

create trigger trg_10_atribuir_seq
  before insert on match_events
  for each row execute function atribuir_seq();

-- 12.2 Guarda de estado: quando um evento pode entrar
create function guardar_evento() returns trigger
language plpgsql security definer set search_path = public as $$
declare st match_status;
begin
  select status into st from matches where id = new.match_id;

  -- Partida encerrada: somente administrador corrige (§29).
  if st = 'FINISHED' and not is_admin(auth.uid()) then
    raise exception 'partida encerrada: somente administrador pode corrigir eventos';
  end if;

  if st = 'SCHEDULED' and new.type <> 'MATCH_STARTED' then
    raise exception 'partida não iniciada: evento % não permitido', new.type;
  end if;

  -- Espelha canRegisterGoal(status): só LIVE e GOLDEN_GOAL.
  if new.type in ('NORMAL_GOAL','KEEPER_GOAL','OWN_GOAL')
     and st not in ('LIVE','GOLDEN_GOAL')
     and not is_admin(auth.uid()) then
    raise exception 'gol não pode ser registrado com a partida em %', st;
  end if;

  return new;
end $$;

create trigger trg_20_guardar_evento
  before insert on match_events
  for each row execute function guardar_evento();

-- 12.3 Coerência referencial do gol e da remoção
create function validar_evento() returns trigger
language plpgsql security definer set search_path = public as $$
declare m matches%rowtype; alvo match_events%rowtype;
begin
  select * into m from matches where id = new.match_id;

  if new.type in ('NORMAL_GOAL','KEEPER_GOAL','OWN_GOAL') then
    if new.team_id not in (m.team_a_id, m.team_b_id) then
      raise exception 'equipe % não disputa esta partida', new.team_id;
    end if;
    -- O autor precisa estar escalado NAQUELA equipe. Vale também para o gol
    -- contra: quem comete é do time do autor; o beneficiado é o adversário.
    if not exists (select 1 from match_lineups
                    where match_id = new.match_id
                      and player_id = new.player_id
                      and team_id = new.team_id) then
      raise exception 'jogador % não está escalado pela equipe %', new.player_id, new.team_id;
    end if;
  end if;

  if new.type = 'GOAL_REMOVED' then
    select * into alvo from match_events where id = new.removed_event_id;
    if alvo.id is null then
      raise exception 'evento removido inexistente';
    end if;
    if alvo.match_id <> new.match_id then
      raise exception 'não é possível remover evento de outra partida';
    end if;
    if alvo.type not in ('NORMAL_GOAL','KEEPER_GOAL','OWN_GOAL') then
      raise exception 'somente gols podem ser removidos';
    end if;
  end if;

  return new;
end $$;

create trigger trg_30_validar_evento
  before insert on match_events
  for each row execute function validar_evento();

-- -----------------------------------------------------------------------------
-- 13. ACEITE DAS REGRAS (§17)
-- -----------------------------------------------------------------------------
create table rules_acceptance (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  accepted_rules_version text not null,
  accepted_at            timestamptz not null default now(),
  unique (user_id, accepted_rules_version)
);
create index idx_rules_acceptance_user on rules_acceptance (user_id);

-- -----------------------------------------------------------------------------
-- 14. AUDITORIA (§48)
-- -----------------------------------------------------------------------------
create table admin_audit_log (
  id            bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  acao          text not null,
  entidade      text not null,
  entidade_id   uuid,
  tournament_id uuid references tournaments(id) on delete set null,
  dados_antes   jsonb,
  dados_depois  jsonb,
  motivo        text,
  created_at    timestamptz not null default now()
);
create index idx_audit_actor on admin_audit_log (actor_user_id, created_at desc);
create index idx_audit_entidade on admin_audit_log (entidade, entidade_id);

create function registrar_auditoria(
  p_acao text, p_entidade text, p_entidade_id uuid,
  p_tournament_id uuid default null, p_antes jsonb default null,
  p_depois jsonb default null, p_motivo text default null
) returns void
language sql security definer set search_path = public as $$
  insert into admin_audit_log (actor_user_id, acao, entidade, entidade_id,
                               tournament_id, dados_antes, dados_depois, motivo)
  values (auth.uid(), p_acao, p_entidade, p_entidade_id,
          p_tournament_id, p_antes, p_depois, p_motivo);
$$;

-- -----------------------------------------------------------------------------
-- 15. FUNÇÕES DE PARTIDA
-- -----------------------------------------------------------------------------

-- Quem pode iniciar: qualquer jogador do torneio (com conta vinculada) ou
-- admin. Quem inicia assume como responsável pela partida.
create function is_jogador_do_torneio(p_tournament_id uuid, uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from team_players tp
      join players p on p.id = tp.player_id
     where tp.tournament_id = p_tournament_id and p.profile_id = uid);
$$;

-- Quem pode registrar/remover gol depois de iniciada, conforme rules.ts:
-- "os jogadores da partida, o juiz responsável e os administradores".
create function is_operador_da_partida(p_match_id uuid, uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select uid is not null and (
    is_admin(uid)
    or exists (select 1 from matches where id = p_match_id and arbitro_user_id = uid)
    or exists (select 1 from match_lineups ml
                 join players p on p.id = ml.player_id
                where ml.match_id = p_match_id and p.profile_id = uid));
$$;

-- Tempo de jogo decorrido, em ms — espelha elapsedMs() de clock.ts.
create function elapsed_ms(m matches, agora timestamptz) returns integer
language sql immutable as $$
  select greatest(0, (extract(epoch from
           (coalesce(m.finished_at, m.paused_at, agora) - m.started_at)) * 1000
         - m.accumulated_paused_ms)::integer)
  where m.started_at is not null;
$$;

-- Placar ponderado derivado dos eventos — espelha computeMatchScore().
-- Gol contra credita o ADVERSÁRIO de quem cometeu; gol removido não conta.
create function placar_partida(p_match_id uuid, out gf_a integer, out gf_b integer)
language plpgsql stable security definer set search_path = public as $$
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

-- 15.1 Iniciar
create function iniciar_partida(p_match_id uuid) returns matches
language plpgsql security definer set search_path = public as $$
declare m matches%rowtype; agora timestamptz := now();
begin
  select * into m from matches where id = p_match_id for update;
  if m.id is null then raise exception 'partida inexistente'; end if;
  if m.status <> 'SCHEDULED' then
    raise exception 'transição de partida inválida: % → LIVE', m.status;
  end if;
  if not (is_admin(auth.uid()) or is_jogador_do_torneio(m.tournament_id, auth.uid())) then
    raise exception 'sem permissão para iniciar esta partida';
  end if;

  update matches set status = 'LIVE', started_at = agora,
         iniciada_por = auth.uid(), arbitro_user_id = auth.uid(), updated_at = agora
   where id = p_match_id returning * into m;

  insert into match_events (match_id, type, clock_ms, created_by)
  values (p_match_id, 'MATCH_STARTED', 0, auth.uid());
  return m;
end $$;

-- 15.2 Pausar — guarda o estado para o qual retomar devolve a partida
create function pausar_partida(p_match_id uuid) returns matches
language plpgsql security definer set search_path = public as $$
declare m matches%rowtype; agora timestamptz := now();
begin
  select * into m from matches where id = p_match_id for update;
  if m.status not in ('LIVE','GOLDEN_GOAL') then
    raise exception 'transição de partida inválida: % → PAUSED', m.status;
  end if;
  if not is_operador_da_partida(p_match_id, auth.uid()) then
    raise exception 'sem permissão para pausar esta partida';
  end if;

  insert into match_events (match_id, type, clock_ms, created_by)
  values (p_match_id, 'MATCH_PAUSED', coalesce(elapsed_ms(m, agora), 0), auth.uid());

  update matches set status = 'PAUSED', status_antes_pausa = m.status,
         paused_at = agora, updated_at = agora
   where id = p_match_id returning * into m;
  return m;
end $$;

-- 15.3 Retomar — volta ao estado anterior (gol de ouro continua gol de ouro)
create function retomar_partida(p_match_id uuid) returns matches
language plpgsql security definer set search_path = public as $$
declare m matches%rowtype; agora timestamptz := now(); destino match_status;
begin
  select * into m from matches where id = p_match_id for update;
  if m.status <> 'PAUSED' then
    raise exception 'transição de partida inválida: % → LIVE', m.status;
  end if;
  if not is_operador_da_partida(p_match_id, auth.uid()) then
    raise exception 'sem permissão para retomar esta partida';
  end if;

  destino := coalesce(m.status_antes_pausa, 'LIVE');

  update matches
     set status = destino,
         status_antes_pausa = null,
         paused_at = null,
         accumulated_paused_ms = m.accumulated_paused_ms
           + greatest(0, (extract(epoch from (agora - m.paused_at)) * 1000)::integer),
         updated_at = agora
   where id = p_match_id returning * into m;

  insert into match_events (match_id, type, clock_ms, created_by)
  values (p_match_id, 'MATCH_RESUMED', coalesce(elapsed_ms(m, agora), 0), auth.uid());
  return m;
end $$;

-- 15.4 Registrar gol — um gol no gol de ouro encerra a partida na hora
create function registrar_gol(
  p_match_id uuid, p_type match_event_type, p_team_id uuid, p_player_id uuid
) returns match_events
language plpgsql security definer set search_path = public as $$
declare m matches%rowtype; ev match_events%rowtype; agora timestamptz := now();
begin
  if p_type not in ('NORMAL_GOAL','KEEPER_GOAL','OWN_GOAL') then
    raise exception '% não é um tipo de gol', p_type;
  end if;
  select * into m from matches where id = p_match_id for update;
  if m.id is null then raise exception 'partida inexistente'; end if;
  if not is_operador_da_partida(p_match_id, auth.uid()) then
    raise exception 'sem permissão para registrar gol nesta partida';
  end if;

  -- clock_ms vem do SERVIDOR. O cliente nunca escolhe o instante do gol.
  insert into match_events (match_id, type, team_id, player_id, clock_ms, created_by)
  values (p_match_id, p_type, p_team_id, p_player_id,
          coalesce(elapsed_ms(m, agora), 0), auth.uid())
  returning * into ev;

  -- statusAfterGoal(): GOLDEN_GOAL → FINISHED
  if m.status = 'GOLDEN_GOAL' then
    insert into match_events (match_id, type, clock_ms, created_by)
    values (p_match_id, 'MATCH_FINISHED', coalesce(elapsed_ms(m, agora), 0), auth.uid());
    update matches set status = 'FINISHED', finished_at = agora, updated_at = agora
     where id = p_match_id;
  end if;

  if m.status = 'FINISHED' then
    perform registrar_auditoria('CORRIGIR_PARTIDA_REGISTRAR_GOL', 'match_events', ev.id,
                                m.tournament_id, null, to_jsonb(ev), null);
  end if;
  return ev;
end $$;

-- 15.5 Remover gol — o evento original NUNCA é apagado (§29)
create function remover_gol(p_match_id uuid, p_event_id uuid, p_motivo text default null)
returns match_events
language plpgsql security definer set search_path = public as $$
declare m matches%rowtype; ev match_events%rowtype; agora timestamptz := now();
begin
  select * into m from matches where id = p_match_id for update;
  if not is_operador_da_partida(p_match_id, auth.uid()) then
    raise exception 'sem permissão para remover gol nesta partida';
  end if;

  insert into match_events (match_id, type, removed_event_id, reason, clock_ms, created_by)
  values (p_match_id, 'GOAL_REMOVED', p_event_id, p_motivo,
          coalesce(elapsed_ms(m, agora), 0), auth.uid())
  returning * into ev;

  if m.status = 'FINISHED' then
    perform registrar_auditoria('CORRIGIR_PARTIDA_REMOVER_GOL', 'match_events', p_event_id,
                                m.tournament_id, null, to_jsonb(ev), p_motivo);
  end if;
  return ev;
end $$;

-- 15.6 Encerrar — espelha statusAtRegulationEnd(): só mata-mata empatado vai
-- para o gol de ouro; empate na fase de grupos é resultado legítimo.
create function encerrar_partida(p_match_id uuid) returns matches
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
  elsif m.phase_kind = 'KNOCKOUT' and a = b then
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
  end if;
  return m;
end $$;

-- 15.7 Papéis — só o admin de fábrica concede ou revoga (§11)
create function conceder_papel(p_user_id uuid, p_role app_role) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_factory_admin(auth.uid()) then
    raise exception 'somente o administrador de fábrica pode conceder papéis';
  end if;
  insert into user_roles (user_id, role, concedido_por)
  values (p_user_id, p_role, auth.uid())
  on conflict (user_id, role) do nothing;
  perform registrar_auditoria('CONCEDER_PAPEL', 'user_roles', p_user_id, null,
                              null, jsonb_build_object('role', p_role), null);
end $$;

create function revogar_papel(p_user_id uuid, p_role app_role) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_factory_admin(auth.uid()) then
    raise exception 'somente o administrador de fábrica pode revogar papéis';
  end if;
  delete from user_roles where user_id = p_user_id and role = p_role;
  perform registrar_auditoria('REVOGAR_PAPEL', 'user_roles', p_user_id, null,
                              jsonb_build_object('role', p_role), null, null);
end $$;

-- -----------------------------------------------------------------------------
-- 16. updated_at automático
-- -----------------------------------------------------------------------------
create function tocar_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create trigger trg_touch_profiles    before update on profiles    for each row execute function tocar_updated_at();
create trigger trg_touch_players     before update on players     for each row execute function tocar_updated_at();
create trigger trg_touch_tournaments before update on tournaments for each row execute function tocar_updated_at();
create trigger trg_touch_teams       before update on teams       for each row execute function tocar_updated_at();

-- =============================================================================
-- 17. ROW LEVEL SECURITY
--
-- Deny-by-default: RLS ligada em tudo, e o que não tem policy é inacessível.
-- Nenhuma policy usa `using (true)` sem justificativa (§47).
-- =============================================================================
alter table profiles         enable row level security;
alter table user_roles       enable row level security;
alter table players          enable row level security;
alter table tournaments      enable row level security;
alter table teams            enable row level security;
alter table team_players     enable row level security;
alter table phases           enable row level security;
alter table matches          enable row level security;
alter table match_lineups    enable row level security;
alter table match_events     enable row level security;
alter table rules_acceptance enable row level security;
alter table admin_audit_log  enable row level security;

-- 17.1 profiles
create policy profiles_select_proprio_ou_admin on profiles for select
  to authenticated using (id = auth.uid() or is_admin(auth.uid()));
create policy profiles_update_proprio on profiles for update
  to authenticated using (id = auth.uid()) with check (id = auth.uid());
-- Sem INSERT (trigger) e sem DELETE (cascata de auth.users).

-- 17.2 user_roles — leitura própria; escrita SÓ via RPC do admin de fábrica
create policy user_roles_select_proprio_ou_admin on user_roles for select
  to authenticated using (user_id = auth.uid() or is_admin(auth.uid()));

-- 17.3 players — nome e foto são públicos: aparecem em escalação, artilharia
-- e histórico, que o §40 garante ao espectador sem conta.
create policy players_select_publico on players for select
  to anon, authenticated using (true);
create policy players_insert_admin on players for insert
  to authenticated with check (is_admin(auth.uid()));
create policy players_update_admin_ou_dono on players for update
  to authenticated using (is_admin(auth.uid()) or profile_id = auth.uid())
  with check (is_admin(auth.uid()) or profile_id = auth.uid());
-- Sem DELETE: jogador com histórico nunca some (§62).

-- 17.4 tournaments
create policy tournaments_select_publico on tournaments for select
  to anon, authenticated using (publico or is_admin(auth.uid()));
create policy tournaments_insert_admin on tournaments for insert
  to authenticated with check (is_admin(auth.uid()));
create policy tournaments_update_admin on tournaments for update
  to authenticated using (is_admin(auth.uid())) with check (is_admin(auth.uid()));
-- Sem DELETE: torneio se encerra, não se apaga.

-- 17.5 teams
create policy teams_select_publico on teams for select
  to anon, authenticated
  using (exists (select 1 from tournaments t
                  where t.id = tournament_id and (t.publico or is_admin(auth.uid()))));
create policy teams_insert_admin on teams for insert
  to authenticated with check (is_admin(auth.uid()));
create policy teams_update_admin on teams for update
  to authenticated using (is_admin(auth.uid())) with check (is_admin(auth.uid()));
create policy teams_delete_admin on teams for delete
  to authenticated using (is_admin(auth.uid()));

-- 17.6 team_players
create policy team_players_select_publico on team_players for select
  to anon, authenticated
  using (exists (select 1 from tournaments t
                  where t.id = tournament_id and (t.publico or is_admin(auth.uid()))));
create policy team_players_insert_admin on team_players for insert
  to authenticated with check (is_admin(auth.uid()));
create policy team_players_update_admin on team_players for update
  to authenticated using (is_admin(auth.uid())) with check (is_admin(auth.uid()));
create policy team_players_delete_admin on team_players for delete
  to authenticated using (is_admin(auth.uid()));

-- 17.7 phases
create policy phases_select_publico on phases for select
  to anon, authenticated
  using (exists (select 1 from tournaments t
                  where t.id = tournament_id and (t.publico or is_admin(auth.uid()))));
create policy phases_insert_admin on phases for insert
  to authenticated with check (is_admin(auth.uid()));
create policy phases_update_admin on phases for update
  to authenticated using (is_admin(auth.uid())) with check (is_admin(auth.uid()));
create policy phases_delete_admin on phases for delete
  to authenticated using (is_admin(auth.uid()));

-- 17.8 matches — leitura pública; agenda pelo admin; RELÓGIO SÓ VIA RPC
create policy matches_select_publico on matches for select
  to anon, authenticated
  using (exists (select 1 from tournaments t
                  where t.id = tournament_id and (t.publico or is_admin(auth.uid()))));
create policy matches_insert_admin on matches for insert
  to authenticated with check (is_admin(auth.uid()));
-- Sem UPDATE para NINGUÉM: status e relógio mudam exclusivamente pelas RPCs,
-- que rodam com now() do servidor. Nem o admin de fábrica altera direto.
-- Sem DELETE.

-- 17.9 match_lineups
create policy lineups_select_publico on match_lineups for select
  to anon, authenticated
  using (exists (select 1 from matches m join tournaments t on t.id = m.tournament_id
                  where m.id = match_id and (t.publico or is_admin(auth.uid()))));
create policy lineups_insert_admin on match_lineups for insert
  to authenticated with check (is_admin(auth.uid()));
create policy lineups_delete_admin on match_lineups for delete
  to authenticated using (is_admin(auth.uid()));

-- 17.10 match_events — leitura pública (é o que o espectador acompanha);
-- escrita EXCLUSIVAMENTE pelas RPCs. Append-only para todos, sempre.
create policy events_select_publico on match_events for select
  to anon, authenticated
  using (exists (select 1 from matches m join tournaments t on t.id = m.tournament_id
                  where m.id = match_id and (t.publico or is_admin(auth.uid()))));
-- Sem INSERT/UPDATE/DELETE: nenhum papel edita ou apaga um evento. Corrigir é
-- inserir um evento novo, via RPC, com auditoria (§29, §51).

-- 17.11 rules_acceptance
create policy aceite_select_proprio on rules_acceptance for select
  to authenticated using (user_id = auth.uid() or is_admin(auth.uid()));
create policy aceite_insert_proprio on rules_acceptance for insert
  to authenticated with check (user_id = auth.uid());
-- Sem UPDATE/DELETE: aceite é registro histórico.

-- 17.12 admin_audit_log — admin lê; ninguém escreve (só as RPCs)
create policy auditoria_select_admin on admin_audit_log for select
  to authenticated using (is_admin(auth.uid()));

-- =============================================================================
-- 18. GRANTS — segunda barreira, abaixo da RLS
-- =============================================================================
revoke all on match_events from anon, authenticated;
grant select on match_events to anon, authenticated;

revoke update, delete on matches from anon, authenticated;
revoke all on app_config from anon, authenticated;
revoke insert, update, delete on admin_audit_log from anon, authenticated;
revoke insert, update, delete on user_roles from anon, authenticated;

grant execute on function iniciar_partida(uuid), pausar_partida(uuid),
  retomar_partida(uuid), encerrar_partida(uuid),
  registrar_gol(uuid, match_event_type, uuid, uuid),
  remover_gol(uuid, uuid, text),
  conceder_papel(uuid, app_role), revogar_papel(uuid, app_role)
  to authenticated;

grant execute on function placar_partida(uuid) to anon, authenticated;

-- Funções internas: só as RPCs e triggers as chamam, nunca o cliente.
revoke execute on function
  is_operador_da_partida(uuid, uuid), is_jogador_do_torneio(uuid, uuid),
  registrar_auditoria(text, text, uuid, uuid, jsonb, jsonb, text),
  sincronizar_escalacao(uuid)
  from anon, authenticated, public;

-- ATENÇÃO: is_admin/is_factory_admin NÃO podem ser revogadas. As policies são
-- avaliadas com os privilégios do usuário da sessão — sem EXECUTE aqui, toda
-- policy que as chama falha com "permission denied" e o app inteiro para.
-- Expor estas duas é aceitável: retornam apenas um booleano sobre um uid.
grant execute on function is_admin(uuid), is_factory_admin(uuid)
  to anon, authenticated;

-- =============================================================================
-- 19. REALTIME (§38)
-- A RLS filtra o que cada assinante recebe — inclusive o espectador anônimo.
-- =============================================================================
alter publication supabase_realtime add table matches;
alter publication supabase_realtime add table match_events;

-- REPLICA IDENTITY FULL em matches: o payload de UPDATE precisa carregar as
-- colunas de relógio para o espectador reconstruir o cronômetro sem refetch.
alter table matches replica identity full;
