begin;
select plan(20);

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
  ('00000000-0000-4000-8000-000000000013', '00000000-0000-4000-8000-000000000003', 'Segundo Teste');

insert into tournaments (id, nome, slug, publico, rules_version, criado_por)
values
  ('00000000-0000-4000-8000-000000000021', 'Público teste', 'security-public-test', true, 'test-v1', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000022', 'Privado teste', 'security-private-test', false, 'test-v1', '00000000-0000-4000-8000-000000000001');

insert into tournament_participants (tournament_id, player_id, inscrito_por)
values
  ('00000000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000002'),
  ('00000000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-000000000013', '00000000-0000-4000-8000-000000000003'),
  ('00000000-0000-4000-8000-000000000022', '00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000002');

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
reset role;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select is((select count(*) from profiles), 1::bigint, 'jogador só lê o próprio profile');
select is((select count(*) from user_roles), 1::bigint, 'jogador só lê o próprio papel');
select is((select count(*) from admin_audit_log), 0::bigint, 'jogador não lê auditoria');
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
select is((select count(*) from profiles), 4::bigint, 'admin lê os profiles para administrar contas');
select is((select count(*) from user_roles), 5::bigint, 'admin lê os papéis de todas as contas');
select ok((select count(*) > 0 from admin_audit_log), 'admin lê a trilha de auditoria');
reset role;

select * from finish();
rollback;
