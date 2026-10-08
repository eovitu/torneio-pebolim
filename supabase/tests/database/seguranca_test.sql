begin;
select plan(43);

-- Supabase local nomeia esta ICU collation com o sufixo do provider; as
-- funções de rodízio usam o alias curto instalado no banco hospedado.
create collation if not exists public."pt-BR" (provider = icu, locale = 'pt-BR');

-- Identidades locais reservadas para este teste; trigger de auth cria perfil e papel PLAYER.
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'admin@security.test', '', now(),
   '{"provider":"email","providers":["email"]}', '{"nome":"Admin Teste"}', now(), now()),
  ('00000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'participante@security.test', '', now(),
   '{"provider":"email","providers":["email"]}', '{"nome":"Participante Teste"}', now(), now()),
  ('00000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'segundo@security.test', '', now(),
   '{"provider":"email","providers":["email"]}', '{"nome":"Segundo Teste"}', now(), now()),
  ('00000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'estranho@security.test', '', now(),
   '{"provider":"email","providers":["email"]}', '{"nome":"Estranho Teste"}', now(), now());

insert into user_roles (user_id, role)
values ('00000000-0000-4000-8000-000000000001', 'ADMIN');

insert into players (id, profile_id, nome)
values
  ('00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000002', 'Participante Teste'),
  ('00000000-0000-4000-8000-000000000013', '00000000-0000-4000-8000-000000000003', 'Segundo Teste'),
  ('00000000-0000-4000-8000-000000000014', null, 'Terceiro Teste'),
  ('00000000-0000-4000-8000-000000000015', null, 'Quarto Teste'),
  ('00000000-0000-4000-8000-000000000016', null, 'Solitario Teste');

insert into tournaments (id, nome, slug, publico, rules_version, criado_por)
values
  ('00000000-0000-4000-8000-000000000021', 'Público teste', 'security-public-test', true, 'test-v1', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000022', 'Privado teste', 'security-private-test', false, 'test-v1', '00000000-0000-4000-8000-000000000001');

insert into tournament_participants (tournament_id, player_id, inscrito_por)
values
  ('00000000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000002'),
  ('00000000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-000000000013', '00000000-0000-4000-8000-000000000003'),
  ('00000000-0000-4000-8000-000000000022', '00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000002');

-- Jogos sintéticos: dois gols normais, um gol contra e um gol removido no
-- placar público; uma derrota da dupla para exercitar o rodízio nos dois
-- escopos de visibilidade.
insert into phases (id, tournament_id, kind, nome, ordem)
values
  ('00000000-0000-4000-8000-000000000031', '00000000-0000-4000-8000-000000000021', 'GROUP', 'Fase pública', 1),
  ('00000000-0000-4000-8000-000000000032', '00000000-0000-4000-8000-000000000022', 'GROUP', 'Fase privada', 1),
  ('00000000-0000-4000-8000-000000000033', '00000000-0000-4000-8000-000000000022', 'KNOCKOUT', 'Copa privada', 2);

insert into teams (id, tournament_id, nome)
values
  ('00000000-0000-4000-8000-000000000041', '00000000-0000-4000-8000-000000000021', 'Dupla pública A'),
  ('00000000-0000-4000-8000-000000000042', '00000000-0000-4000-8000-000000000021', 'Dupla pública B'),
  ('00000000-0000-4000-8000-000000000043', '00000000-0000-4000-8000-000000000021', 'Solo público'),
  ('00000000-0000-4000-8000-000000000044', '00000000-0000-4000-8000-000000000022', 'Dupla privada A'),
  ('00000000-0000-4000-8000-000000000045', '00000000-0000-4000-8000-000000000022', 'Dupla privada B'),
  ('00000000-0000-4000-8000-000000000046', '00000000-0000-4000-8000-000000000022', 'Solo privado');

insert into team_players (team_id, player_id)
values
  ('00000000-0000-4000-8000-000000000041', '00000000-0000-4000-8000-000000000012'),
  ('00000000-0000-4000-8000-000000000041', '00000000-0000-4000-8000-000000000013'),
  ('00000000-0000-4000-8000-000000000042', '00000000-0000-4000-8000-000000000014'),
  ('00000000-0000-4000-8000-000000000042', '00000000-0000-4000-8000-000000000015'),
  ('00000000-0000-4000-8000-000000000043', '00000000-0000-4000-8000-000000000016'),
  ('00000000-0000-4000-8000-000000000044', '00000000-0000-4000-8000-000000000012'),
  ('00000000-0000-4000-8000-000000000044', '00000000-0000-4000-8000-000000000013'),
  ('00000000-0000-4000-8000-000000000045', '00000000-0000-4000-8000-000000000014'),
  ('00000000-0000-4000-8000-000000000045', '00000000-0000-4000-8000-000000000015'),
  ('00000000-0000-4000-8000-000000000046', '00000000-0000-4000-8000-000000000016');

insert into matches (id, tournament_id, phase_id, phase_kind, label, ordem,
                     team_a_id, team_b_id, status, started_at, finished_at)
values
  ('00000000-0000-4000-8000-000000000051', '00000000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-000000000031', 'GROUP', 'Pública', 1,
   '00000000-0000-4000-8000-000000000041', '00000000-0000-4000-8000-000000000042', 'LIVE', now(), null),
  ('00000000-0000-4000-8000-000000000052', '00000000-0000-4000-8000-000000000022', '00000000-0000-4000-8000-000000000032', 'GROUP', 'Privada', 1,
   '00000000-0000-4000-8000-000000000044', '00000000-0000-4000-8000-000000000045', 'LIVE', now(), null),
  ('00000000-0000-4000-8000-000000000053', '00000000-0000-4000-8000-000000000022', '00000000-0000-4000-8000-000000000033', 'KNOCKOUT', 'Privada interna', 1,
   '00000000-0000-4000-8000-000000000044', '00000000-0000-4000-8000-000000000045', 'LIVE', now(), null);

insert into match_events (id, match_id, type, team_id, player_id, clock_ms, reason)
values
  ('00000000-0000-4000-8000-000000000061', '00000000-0000-4000-8000-000000000051', 'NORMAL_GOAL', '00000000-0000-4000-8000-000000000041', '00000000-0000-4000-8000-000000000012', 1000, null),
  ('00000000-0000-4000-8000-000000000062', '00000000-0000-4000-8000-000000000051', 'OWN_GOAL', '00000000-0000-4000-8000-000000000042', '00000000-0000-4000-8000-000000000014', 2000, null),
  ('00000000-0000-4000-8000-000000000063', '00000000-0000-4000-8000-000000000051', 'NORMAL_GOAL', '00000000-0000-4000-8000-000000000042', '00000000-0000-4000-8000-000000000015', 3000, null),
  ('00000000-0000-4000-8000-000000000064', '00000000-0000-4000-8000-000000000051', 'KEEPER_GOAL', '00000000-0000-4000-8000-000000000041', '00000000-0000-4000-8000-000000000013', 4000, null);

insert into match_events (match_id, type, clock_ms, removed_event_id, reason)
values ('00000000-0000-4000-8000-000000000051', 'GOAL_REMOVED', 5000,
        '00000000-0000-4000-8000-000000000064', 'Teste removido');

update matches set status = 'FINISHED', finished_at = now()
 where id = '00000000-0000-4000-8000-000000000051';

insert into match_events (match_id, type, team_id, player_id, clock_ms)
values
  ('00000000-0000-4000-8000-000000000052', 'NORMAL_GOAL', '00000000-0000-4000-8000-000000000044', '00000000-0000-4000-8000-000000000012', 1000),
  ('00000000-0000-4000-8000-000000000052', 'NORMAL_GOAL', '00000000-0000-4000-8000-000000000045', '00000000-0000-4000-8000-000000000014', 2000),
  ('00000000-0000-4000-8000-000000000052', 'NORMAL_GOAL', '00000000-0000-4000-8000-000000000045', '00000000-0000-4000-8000-000000000015', 3000),
  ('00000000-0000-4000-8000-000000000053', 'NORMAL_GOAL', '00000000-0000-4000-8000-000000000044', '00000000-0000-4000-8000-000000000012', 1000),
  ('00000000-0000-4000-8000-000000000053', 'NORMAL_GOAL', '00000000-0000-4000-8000-000000000045', '00000000-0000-4000-8000-000000000014', 2000);

update matches set status = 'FINISHED', finished_at = now()
    , iniciada_por = '00000000-0000-4000-8000-000000000002'
 where id = '00000000-0000-4000-8000-000000000052';

insert into admin_audit_log (actor_user_id, acao, entidade)
values ('00000000-0000-4000-8000-000000000001', 'TESTE', 'test');

select is(has_function_privilege('anon', 'public.is_participante_do_torneio(uuid,uuid)', 'EXECUTE'), false,
          'anon não executa a função auxiliar');
select is(has_function_privilege('authenticated', 'public.is_participante_do_torneio(uuid,uuid)', 'EXECUTE'), false,
          'authenticated não executa a função auxiliar');
select is(has_function_privilege('authenticated', 'public.iniciar_torneio(uuid)', 'EXECUTE'), true,
          'authenticated executa a RPC pública de início');
select is(has_function_privilege('anon', 'public.iniciar_torneio(uuid)', 'EXECUTE'), false,
          'anon não executa iniciar_torneio');
select is(has_function_privilege('anon', 'public.placar_partida(uuid)', 'EXECUTE'), true,
          'anon mantém o grant público do placar');
select is(has_function_privilege('authenticated', 'public.placar_partida(uuid)', 'EXECUTE'), true,
          'authenticated mantém o grant público do placar');
select is(has_function_privilege('anon', 'public.rodizio_sugerido(uuid)', 'EXECUTE'), false,
          'anon não executa a sugestão de rodízio');
select is(has_function_privilege('authenticated', 'public.rodizio_sugerido(uuid)', 'EXECUTE'), true,
          'authenticated mantém o grant da sugestão de rodízio');
select is(coalesce(has_function_privilege('authenticated',
            to_regprocedure('public.rodizio_sugerido_interno(uuid)'), 'EXECUTE'), false), false,
          'cliente autenticado não executa o cálculo interno do rodízio');
select is(has_table_privilege('authenticated', 'public.matches', 'UPDATE'), false,
          'cliente não tem UPDATE direto em matches');
select is(has_column_privilege('authenticated', 'public.teams', 'nome', 'UPDATE'), true,
          'cliente pode atualizar a coluna permitida nome');
select is(has_column_privilege('authenticated', 'public.teams', 'tournament_id', 'UPDATE'), false,
          'cliente não pode mover equipe entre torneios');

set local role anon;
select set_config('request.jwt.claim.role', 'anon', true);
select is((select count(*) from tournaments), 1::bigint, 'anon só lê torneio público');
select is((select count(*) from profiles), 0::bigint, 'anon não recebe linhas de profiles privados');
select is((select gf_a::text || ':' || gf_b::text from placar_partida('00000000-0000-4000-8000-000000000051')),
          '2:1', 'placar público conta gol normal, gol contra e ignora gol removido');
select is((select count(*) from matches where id = '00000000-0000-4000-8000-000000000052'),
          0::bigint, 'RLS direta oculta a partida privada para anon');
select is((select count(*) from match_events where match_id = '00000000-0000-4000-8000-000000000052'),
          0::bigint, 'RLS direta oculta os eventos privados para anon');
select is((select gf_a::text || ':' || gf_b::text from placar_partida('00000000-0000-4000-8000-000000000052')),
          '0:0', 'placar de partida privada não revela gols para anon');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select is((select count(*) from profiles), 1::bigint, 'jogador só lê o próprio profile');
select is((select count(*) from user_roles), 1::bigint, 'jogador só lê o próprio papel');
select is((select count(*) from admin_audit_log), 0::bigint, 'jogador não lê auditoria');
select is((select count(*) from matches where id = '00000000-0000-4000-8000-000000000052'),
          0::bigint, 'RLS direta oculta a partida privada para jogador');
select is((select count(*) from match_events where match_id = '00000000-0000-4000-8000-000000000052'),
          0::bigint, 'RLS direta oculta eventos privados para jogador');
select is((select gf_a::text || ':' || gf_b::text from placar_partida('00000000-0000-4000-8000-000000000052')),
          '0:0', 'placar privado não revela gols a jogador não-admin');
select is((select count(*) from rodizio_sugerido('00000000-0000-4000-8000-000000000051')),
          1::bigint, 'rodízio de partida pública continua disponível');
select is((select count(*) from rodizio_sugerido('00000000-0000-4000-8000-000000000052')),
          0::bigint, 'rodízio privado não devolve roster a jogador não-admin');
select lives_ok($$select public.iniciar_torneio('00000000-0000-4000-8000-000000000021')$$,
                'participante consegue iniciar pelo RPC autorizado');
select is((select status::text from tournaments where id = '00000000-0000-4000-8000-000000000021'),
          'EM_ANDAMENTO', 'RPC legítima iniciou o torneio');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000004', true);
select throws_ok(
  $$select public.iniciar_torneio('00000000-0000-4000-8000-000000000021')$$,
  'P0001', 'só quem está inscrito neste torneio pode começá-lo',
  'usuário estranho não inicia o torneio'
);
select throws_ok(
  $$update public.matches set status = status where false$$,
  '42501', null, 'UPDATE direto em matches é negado');
select throws_ok(
  $$update public.teams set tournament_id = '00000000-0000-4000-8000-000000000022'
    where tournament_id = '00000000-0000-4000-8000-000000000021'$$,
  '42501', null, 'UPDATE de coluna protegida de teams é negado');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select is((select gf_a::text || ':' || gf_b::text from placar_partida('00000000-0000-4000-8000-000000000052')),
          '1:2', 'admin lê o placar privado correto');
select is((select count(*) from rodizio_sugerido('00000000-0000-4000-8000-000000000052')),
          1::bigint, 'admin recebe a sugestão de rodízio privada');
select ok((select vai_player_id in ('00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000013')
                  and fica_player_id in ('00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000013')
                  and vai_player_id <> fica_player_id
             from rodizio_sugerido('00000000-0000-4000-8000-000000000052')),
          'sugestão privada do admin usa a dupla que perdeu');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000004', true);
select throws_ok(
  $$select public.resolver_rodizio('00000000-0000-4000-8000-000000000052', true)$$,
  'P0001', 'só quem conduziu esta partida pode decidir o rodízio',
  'usuário não autorizado não resolve o rodízio privado');
select throws_ok(
  $$select public.encerrar_partida('00000000-0000-4000-8000-000000000053')$$,
  'P0001', 'sem permissão para encerrar esta partida',
  'usuário não autorizado não encerra partida privada');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select lives_ok($$select public.resolver_rodizio('00000000-0000-4000-8000-000000000052', true)$$,
                'juiz/iniciador autorizado resolve rodízio de partida privada');
reset role;
select is((select count(*) from team_players where team_id = '00000000-0000-4000-8000-000000000046'),
          2::bigint, 'resolução interna move um jogador para a equipe solitária privada');
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select lives_ok($$select public.encerrar_partida('00000000-0000-4000-8000-000000000053')$$,
                'admin encerra via SECURITY DEFINER que calcula o placar privado');
select is((select status::text from matches where id = '00000000-0000-4000-8000-000000000053'),
          'GOLDEN_GOAL', 'placar empatado continua acionando gol de ouro no fluxo interno');
select is((select count(*) from profiles), 4::bigint, 'admin lê os profiles para administrar contas');
select is((select count(*) from user_roles), 5::bigint, 'admin lê os papéis de todas as contas');
select ok((select count(*) > 0 from admin_audit_log), 'admin lê a trilha de auditoria');
reset role;

select * from finish();
rollback;
