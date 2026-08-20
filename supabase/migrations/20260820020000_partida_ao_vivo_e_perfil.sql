-- =============================================================================
-- torneio-pebolim — suporte à partida ao vivo e ao perfil do usuário
--
-- Traz três coisas:
--   1. relógio do servidor exposto ao cliente, para corrigir desvio de horário;
--   2. tolerância de registro de 2 segundos após o fim do tempo regulamentar;
--   3. vínculo jogador ↔ conta e o bucket de avatares.
-- =============================================================================

set search_path = public;

-- -----------------------------------------------------------------------------
-- 1. RELÓGIO DO SERVIDOR
--
-- O cronômetro é derivado de timestamps do servidor, mas quem desenha a
-- contagem é o navegador — e o relógio do celular pode estar minutos adiantado
-- ou atrasado. Sem uma referência, o cronômetro mostraria um tempo que não é o
-- da partida. O cliente lê esta função uma vez, mede o desvio e corrige.
--
-- Não é dado sensível: é a hora, que qualquer resposta HTTP já carrega.
-- -----------------------------------------------------------------------------
create function relogio_servidor() returns timestamptz
language sql stable as $$
  select now();
$$;

-- -----------------------------------------------------------------------------
-- 2. TOLERÂNCIA DE REGISTRO APÓS O TEMPO REGULAMENTAR
--
-- REGRA (decisão do proprietário): a partida acaba aos 3 minutos (§18). Um gol
-- só é aceito até 2 segundos depois de 00:00.
--
-- Isto é TOLERÂNCIA DE REGISTRO, não de jogo: não estende a partida em 2
-- segundos, nem faz o cronômetro contar até 03:02. Existe apenas para cobrir o
-- intervalo entre a bola entrar e o dedo alcançar o botão. Uma bola que entra
-- depois de 00:00 não vira gol por causa dela.
--
-- No gol de ouro não há limite de tempo, então a tolerância não se aplica.
-- -----------------------------------------------------------------------------
create or replace function registrar_gol(
  p_match_id uuid, p_type match_event_type, p_team_id uuid, p_player_id uuid
) returns match_events
language plpgsql security definer set search_path = public as $$
declare
  m         matches%rowtype;
  ev        match_events%rowtype;
  agora     timestamptz := now();
  decorrido integer;
  -- Espelham MATCH_DURATION_MS de packages/domain/src/types.ts e a tolerância
  -- acordada com o proprietário.
  duracao_ms    constant integer := 180000;
  tolerancia_ms constant integer := 2000;
begin
  if p_type not in ('NORMAL_GOAL','KEEPER_GOAL','OWN_GOAL') then
    raise exception '% não é um tipo de gol', p_type;
  end if;
  select * into m from matches where id = p_match_id for update;
  if m.id is null then raise exception 'partida inexistente'; end if;
  if not is_operador_da_partida(p_match_id, auth.uid()) then
    raise exception 'sem permissão para registrar gol nesta partida';
  end if;

  decorrido := coalesce(elapsed_ms(m, agora), 0);

  if m.status = 'LIVE' and decorrido > duracao_ms + tolerancia_ms then
    raise exception
      'tempo regulamentar esgotado: o gol precisa ser registrado em até % segundos após 00:00',
      tolerancia_ms / 1000;
  end if;

  -- clock_ms vem do SERVIDOR. O cliente nunca escolhe o instante do gol.
  insert into match_events (match_id, type, team_id, player_id, clock_ms, created_by)
  values (p_match_id, p_type, p_team_id, p_player_id, decorrido, auth.uid())
  returning * into ev;

  -- statusAfterGoal(): GOLDEN_GOAL → FINISHED
  if m.status = 'GOLDEN_GOAL' then
    insert into match_events (match_id, type, clock_ms, created_by)
    values (p_match_id, 'MATCH_FINISHED', decorrido, auth.uid());
    update matches set status = 'FINISHED', finished_at = agora, updated_at = agora
     where id = p_match_id;
  end if;

  if m.status = 'FINISHED' then
    perform registrar_auditoria('CORRIGIR_PARTIDA_REGISTRAR_GOL', 'match_events', ev.id,
                                m.tournament_id, null, to_jsonb(ev), null);
  end if;
  return ev;
end $$;

-- -----------------------------------------------------------------------------
-- 3. VÍNCULO JOGADOR ↔ CONTA
--
-- O jogador é cadastrado pelo admin antes de ter conta. Quando a pessoa se
-- cadastra, alguém precisa dizer qual registro é o dela — e isso é o admin
-- quem faz (decisão do proprietário), para ninguém reivindicar o nome de
-- outro. O vínculo é o que permite operar partidas: `is_jogador_do_torneio` e
-- `is_operador_da_partida` chegam ao usuário por `players.profile_id`.
-- -----------------------------------------------------------------------------
create function vincular_jogador_conta(p_player_id uuid, p_user_id uuid)
returns players
language plpgsql security definer set search_path = public as $$
declare j players%rowtype; anterior uuid;
begin
  if not is_admin(auth.uid()) then
    raise exception 'somente administrador pode vincular contas a jogadores';
  end if;

  select * into j from players where id = p_player_id for update;
  if j.id is null then raise exception 'jogador inexistente'; end if;
  anterior := j.profile_id;

  if p_user_id is not null then
    if not exists (select 1 from profiles where id = p_user_id) then
      raise exception 'não existe perfil para esta conta';
    end if;
    if exists (select 1 from players where profile_id = p_user_id and id <> p_player_id) then
      raise exception 'esta conta já está vinculada a outro jogador';
    end if;
  end if;

  update players set profile_id = p_user_id, updated_at = now()
   where id = p_player_id returning * into j;

  perform registrar_auditoria(
    case when p_user_id is null then 'DESVINCULAR_CONTA_JOGADOR' else 'VINCULAR_CONTA_JOGADOR' end,
    'players', p_player_id, null,
    jsonb_build_object('profile_id', anterior),
    jsonb_build_object('profile_id', p_user_id), null);
  return j;
end $$;

-- -----------------------------------------------------------------------------
-- 4. PERFIS VISÍVEIS PARA O ADMIN VINCULAR
--
-- Para escolher a conta, o admin precisa enxergar as contas — e a policy de
-- `profiles` já permite isso a administradores. Este índice só evita varredura
-- quando a lista crescer.
-- -----------------------------------------------------------------------------
create index if not exists idx_profiles_nome on profiles (lower(nome));

-- -----------------------------------------------------------------------------
-- 5. AVATARES — bucket e políticas
--
-- Leitura pública: a foto aparece em escalação, artilharia e histórico, que o
-- visitante sem conta pode ver (§40). Escrita restrita: cada um só mexe na
-- própria pasta, cujo nome é o id do usuário.
--
-- Tipo e tamanho são limitados no próprio bucket, não só na interface — a
-- validação do navegador é conveniência, não barreira (§49).
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152,
        array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update
   set public             = excluded.public,
       file_size_limit    = excluded.file_size_limit,
       allowed_mime_types = excluded.allowed_mime_types;

create policy avatares_leitura_publica on storage.objects for select
  to anon, authenticated using (bucket_id = 'avatars');

-- `storage.foldername(name)[1]` é a primeira pasta do caminho. Guardamos em
-- `avatars/<user_id>/arquivo`, então isto amarra a escrita ao dono.
create policy avatares_envio_proprio on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy avatares_troca_propria on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy avatares_remocao_propria on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- -----------------------------------------------------------------------------
-- 6. EXECUTE
-- -----------------------------------------------------------------------------
revoke execute on function relogio_servidor() from public;
grant  execute on function relogio_servidor() to anon, authenticated;

revoke execute on function vincular_jogador_conta(uuid, uuid) from public, anon, authenticated;
grant  execute on function vincular_jogador_conta(uuid, uuid) to authenticated;
