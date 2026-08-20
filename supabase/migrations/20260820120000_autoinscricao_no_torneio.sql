-- =============================================================================
-- AUTOINSCRIÇÃO NO TORNEIO
--
-- Decisão do proprietário (20/08/2026): o próprio usuário logado entra no
-- torneio, sem aprovação do administrador, e a inscrição fica aberta SOMENTE
-- enquanto o torneio está em CONFIGURACAO. Depois do sorteio das equipes o
-- campeonato está montado, e ninguém entra no meio.
--
-- Até aqui não existia o conceito de "inscrito": o admin cadastrava `players`
-- soltos e escolhia na mão quem entrava no sorteio. `tournament_participants`
-- passa a ser a lista de quem se inscreveu — o sorteio continua sendo um ato
-- explícito do admin, apenas com a lista já pronta.
--
-- Nada aqui altera regra esportiva, placar, estatística ou permissão de
-- operação de partida.
-- =============================================================================

create table tournament_participants (
  tournament_id uuid not null references tournaments(id) on delete cascade,
  player_id     uuid not null references players(id)      on delete cascade,
  -- Quem efetivou a inscrição: o próprio usuário, ou o admin que inscreveu.
  inscrito_por  uuid references auth.users(id) on delete set null,
  auto_inscrito boolean not null default false,
  created_at    timestamptz not null default now(),
  primary key (tournament_id, player_id)
);
create index idx_participantes_player on tournament_participants (player_id);

alter table tournament_participants enable row level security;

-- Leitura pública: a lista de participantes aparece na página do torneio, que
-- o §40 garante ao visitante sem conta.
create policy participantes_select_publico on tournament_participants for select
  to anon, authenticated
  using (exists (select 1 from tournaments t
                  where t.id = tournament_id and (t.publico or is_admin(auth.uid()))));

-- Inserção direta só do admin (inscrever alguém no lugar da pessoa). O usuário
-- comum entra pela RPC, que valida estado do torneio e cria o player dele.
create policy participantes_insert_admin on tournament_participants for insert
  to authenticated with check (is_admin(auth.uid()));

-- Remoção: o admin sempre; a própria pessoa só enquanto ainda dá para se
-- inscrever, e desde que ainda não tenha sido sorteada em uma equipe.
create policy participantes_delete_admin_ou_proprio on tournament_participants for delete
  to authenticated
  using (
    is_admin(auth.uid())
    or (
      exists (select 1 from players p
               where p.id = tournament_participants.player_id and p.profile_id = auth.uid())
      and exists (select 1 from tournaments t
                   where t.id = tournament_participants.tournament_id
                     and t.status = 'CONFIGURACAO')
      and not exists (select 1 from team_players tp
                       where tp.tournament_id = tournament_participants.tournament_id
                         and tp.player_id = tournament_participants.player_id)
    )
  );

-- -----------------------------------------------------------------------------
-- Backfill: quem já está numa equipe já é participante do torneio.
-- -----------------------------------------------------------------------------
insert into tournament_participants (tournament_id, player_id, auto_inscrito)
select tp.tournament_id, tp.player_id, false
  from team_players tp
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- RPC: inscrever-se
--
-- SECURITY DEFINER porque precisa criar a linha em `players` para quem ainda
-- não tem uma — `players_insert_admin` não deixaria. As validações abaixo
-- substituem a policy: usuário autenticado, torneio público e em CONFIGURACAO.
-- -----------------------------------------------------------------------------
create function inscrever_se_no_torneio(p_tournament_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid       uuid := auth.uid();
  v_torneio   tournaments%rowtype;
  v_perfil    profiles%rowtype;
  v_player_id uuid;
begin
  if v_uid is null then
    raise exception 'é preciso estar conectado para entrar em um torneio';
  end if;

  select * into v_torneio from tournaments where id = p_tournament_id for update;
  if v_torneio.id is null then
    raise exception 'torneio inexistente';
  end if;
  if not v_torneio.publico and not is_admin(v_uid) then
    raise exception 'este torneio não está aberto';
  end if;
  if v_torneio.status <> 'CONFIGURACAO' then
    raise exception 'as inscrições deste torneio já foram encerradas';
  end if;

  select * into v_perfil from profiles where id = v_uid;
  if v_perfil.id is null then
    raise exception 'perfil não encontrado';
  end if;

  -- Um jogador por conta. Se a pessoa já joga em outro torneio, reaproveita a
  -- mesma linha — o histórico dela é um só.
  select id into v_player_id from players where profile_id = v_uid;
  if v_player_id is null then
    insert into players (profile_id, nome, foto_url)
    values (v_uid, v_perfil.nome, v_perfil.avatar_url)
    returning id into v_player_id;
  end if;

  insert into tournament_participants (tournament_id, player_id, inscrito_por, auto_inscrito)
  values (p_tournament_id, v_player_id, v_uid, true)
  on conflict do nothing;

  perform registrar_auditoria('INSCREVER_NO_TORNEIO', 'tournament_participants',
                              p_tournament_id, v_player_id, null,
                              jsonb_build_object('player_id', v_player_id),
                              'Autoinscrição');

  return v_player_id;
end $$;

revoke execute on function inscrever_se_no_torneio(uuid) from public, anon;
grant  execute on function inscrever_se_no_torneio(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- RPC: sair do torneio
--
-- Existe para dar uma mensagem honesta quando não dá — a policy de DELETE
-- sozinha só devolveria "0 linhas afetadas", e a pessoa não saberia por quê.
-- -----------------------------------------------------------------------------
create function sair_do_torneio(p_tournament_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid       uuid := auth.uid();
  v_torneio   tournaments%rowtype;
  v_player_id uuid;
begin
  if v_uid is null then
    raise exception 'é preciso estar conectado';
  end if;

  select * into v_torneio from tournaments where id = p_tournament_id for update;
  if v_torneio.id is null then raise exception 'torneio inexistente'; end if;
  if v_torneio.status <> 'CONFIGURACAO' then
    raise exception 'o torneio já saiu da configuração; fale com o organizador';
  end if;

  select id into v_player_id from players where profile_id = v_uid;
  if v_player_id is null then return; end if;

  if exists (select 1 from team_players
              where tournament_id = p_tournament_id and player_id = v_player_id) then
    raise exception 'você já foi sorteado em uma equipe; fale com o organizador';
  end if;

  delete from tournament_participants
   where tournament_id = p_tournament_id and player_id = v_player_id;

  perform registrar_auditoria('SAIR_DO_TORNEIO', 'tournament_participants',
                              p_tournament_id, v_player_id,
                              jsonb_build_object('player_id', v_player_id), null,
                              'Saída por conta própria');
end $$;

revoke execute on function sair_do_torneio(uuid) from public, anon;
grant  execute on function sair_do_torneio(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- O sorteio passa a registrar como participante quem entrou direto pela mão do
-- admin (fluxo antigo), para que as duas portas alimentem a mesma lista.
-- -----------------------------------------------------------------------------
create function trg_participante_ao_entrar_em_equipe() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into tournament_participants (tournament_id, player_id)
  values (new.tournament_id, new.player_id)
  on conflict do nothing;
  return null;
end $$;

create trigger trg_40_participante_do_elenco
  after insert on team_players
  for each row execute function trg_participante_ao_entrar_em_equipe();

grant select on tournament_participants to anon, authenticated;

-- A função de trigger não é uma RPC. Sem este revoke ela fica exposta em
-- /rest/v1/rpc — chamá-la fora de um trigger só levantaria erro, mas a postura
-- do projeto é deny-by-default e nenhuma função entra na API sem motivo (§47).
revoke execute on function trg_participante_ao_entrar_em_equipe() from public, anon, authenticated;
