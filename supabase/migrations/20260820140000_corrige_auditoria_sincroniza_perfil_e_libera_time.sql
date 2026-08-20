-- =============================================================================
-- 1. CORREÇÃO: auditoria da inscrição gravava o id errado
--
-- `registrar_auditoria` tem a assinatura
--   (p_acao, p_entidade, p_entidade_id, p_tournament_id, p_antes, p_depois, p_motivo)
--
-- As duas RPCs de inscrição passavam o id do JOGADOR na 4ª posição, que é
-- `p_tournament_id` e tem FK para `tournaments`. Nenhum id de jogador existe
-- lá, então toda inscrição estourava
--   admin_audit_log_tournament_id_fkey
-- e revertia inteira. Como nada chegava a `tournament_participants`, a lista
-- de inscritos ficava vazia — e a tela de sorteio, sem ninguém para marcar.
--
-- A correção usa PARÂMETROS NOMEADOS. O erro só foi possível porque a ordem
-- posicional de sete argumentos é fácil de trocar sem ninguém perceber; com
-- nome, trocar exige errar o nome.
-- =============================================================================

create or replace function inscrever_se_no_torneio(p_tournament_id uuid) returns uuid
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

  perform registrar_auditoria(
    p_acao          => 'INSCREVER_NO_TORNEIO',
    p_entidade      => 'tournament_participants',
    p_entidade_id   => v_player_id,
    p_tournament_id => p_tournament_id,
    p_depois        => jsonb_build_object('player_id', v_player_id),
    p_motivo        => 'Autoinscrição');

  return v_player_id;
end $$;

create or replace function sair_do_torneio(p_tournament_id uuid) returns void
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

  perform registrar_auditoria(
    p_acao          => 'SAIR_DO_TORNEIO',
    p_entidade      => 'tournament_participants',
    p_entidade_id   => v_player_id,
    p_tournament_id => p_tournament_id,
    p_antes         => jsonb_build_object('player_id', v_player_id),
    p_motivo        => 'Saída por conta própria');
end $$;

-- =============================================================================
-- 2. SINCRONIZAÇÃO profiles → players
--
-- `profiles` é PRIVADO (só o dono e o admin leem) e `players` é o que aparece
-- publicamente. Essa separação é proposital e continua intacta: o gatilho
-- copia exatamente os dois campos que já eram públicos em `players` — nome e
-- foto. Nada que era privado passa a ser visível.
--
-- Antes, quem sincronizava era o navegador, dentro da tela de perfil. O
-- resultado é que quem nunca abriu aquela tela aparecia na artilharia com o
-- nome do cadastro e sem foto — foi o que aconteceu no primeiro uso.
--
-- Fazer isso no banco resolve para todas as portas de uma vez: tela de perfil,
-- criação do jogador pela autoinscrição, ou qualquer alteração futura.
-- =============================================================================

create function sincronizar_jogador_com_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update players
     set nome     = new.nome,
         -- Foto nova nunca apaga a que o jogador já tinha: `players.foto_url`
         -- pode ter sido preenchida pelo organizador para quem não tem conta.
         foto_url = coalesce(new.avatar_url, foto_url)
   where profile_id = new.id
     and (nome is distinct from new.nome
          or (new.avatar_url is not null and foto_url is distinct from new.avatar_url));
  return null;
end $$;

create trigger trg_50_sincronizar_jogador
  after update of nome, avatar_url on profiles
  for each row execute function sincronizar_jogador_com_perfil();

-- Alinha quem já existe: sem isto, só quem editasse o perfil de novo apareceria
-- corretamente.
update players p
   set nome     = f.nome,
       foto_url = coalesce(f.avatar_url, p.foto_url)
  from profiles f
 where p.profile_id = f.id
   and (p.nome is distinct from f.nome
        or (f.avatar_url is not null and p.foto_url is distinct from f.avatar_url));

-- =============================================================================
-- 3. REGRA NOVA: o jogador personaliza o próprio time
--
-- Aprovado pelo proprietário em 20/08/2026. Até aqui só o administrador podia
-- alterar uma equipe, o que fazia o botão "Personalizar time" existir para uma
-- pessoa só.
--
-- A trava é a que o proprietário pediu: só o time em que a pessoa está. Quem
-- não é do elenco não altera nada, e o administrador continua podendo tudo.
--
-- Duas barreiras, não uma:
--  - a POLICY decide QUAIS linhas cada um altera;
--  - o GRANT por coluna decide QUAIS campos podem ser alterados. Sem ele, uma
--    policy de UPDATE deixaria mexer em `tournament_id` e mudar a equipe de
--    campeonato. RLS não filtra coluna; grant filtra.
-- =============================================================================

drop policy if exists teams_update_admin on teams;

create policy teams_update_admin_ou_integrante on teams for update
  to authenticated
  using (
    is_admin(auth.uid())
    or exists (select 1 from team_players tp
                 join players p on p.id = tp.player_id
                where tp.team_id = teams.id and p.profile_id = auth.uid())
  )
  with check (
    is_admin(auth.uid())
    or exists (select 1 from team_players tp
                 join players p on p.id = tp.player_id
                where tp.team_id = teams.id and p.profile_id = auth.uid())
  );

-- Só identidade visual é editável pelo cliente. `id`, `tournament_id`,
-- `created_at` e `updated_at` ficam fora do alcance de qualquer papel.
revoke update on teams from anon, authenticated;
grant  update (nome, descricao, logo_url, cor_primaria) on teams to authenticated;

-- A troca de identidade da equipe é auditável, como toda alteração relevante.
create function auditar_alteracao_de_equipe() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.nome is distinct from old.nome
     or new.descricao is distinct from old.descricao
     or new.logo_url is distinct from old.logo_url
     or new.cor_primaria is distinct from old.cor_primaria then
    perform registrar_auditoria(
      p_acao          => 'PERSONALIZAR_EQUIPE',
      p_entidade      => 'teams',
      p_entidade_id   => new.id,
      p_tournament_id => new.tournament_id,
      p_antes         => jsonb_build_object('nome', old.nome, 'descricao', old.descricao,
                                            'logo_url', old.logo_url,
                                            'cor_primaria', old.cor_primaria),
      p_depois        => jsonb_build_object('nome', new.nome, 'descricao', new.descricao,
                                            'logo_url', new.logo_url,
                                            'cor_primaria', new.cor_primaria));
  end if;
  return null;
end $$;

create trigger trg_60_auditar_equipe
  after update on teams
  for each row execute function auditar_alteracao_de_equipe();

-- Funções de gatilho não são RPC: fora da API pública (§47).
revoke execute on function sincronizar_jogador_com_perfil() from public, anon, authenticated;
revoke execute on function auditar_alteracao_de_equipe()    from public, anon, authenticated;
