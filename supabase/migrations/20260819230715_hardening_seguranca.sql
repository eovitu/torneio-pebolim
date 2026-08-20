-- =============================================================================
-- torneio-pebolim — hardening de segurança
-- Projeto Supabase: fgbpeuanyoefjcywhvkh
--
-- Corrige os apontamentos do linter de segurança sobre a migration inicial:
--
--   1. O Postgres concede EXECUTE a PUBLIC em toda função nova. Isso expôs as
--      funções de trigger e as auxiliares internas como endpoints REST em
--      /rest/v1/rpc/<nome>. Nenhuma é explorável — função de trigger chamada
--      fora de um trigger falha no próprio Postgres —, mas é superfície de API
--      que não deveria existir.
--   2. `tocar_updated_at` e `elapsed_ms` ficaram sem `search_path` fixo.
--
-- E corrige um defeito descoberto ao validar o item 1: nenhuma tabela tinha
-- privilégio de tabela para `anon`/`authenticated` (seção 3).
--
-- `app_config` NÃO é tocada: RLS habilitada sem policy é o deny-all pretendido
-- (só funções SECURITY DEFINER leem a tabela), não um defeito.
-- =============================================================================

set search_path = public;

-- -----------------------------------------------------------------------------
-- 1. search_path fixo nas duas funções que ficaram de fora
--
-- Sem isto, quem chama decide o que os nomes não qualificados resolvem. Nenhuma
-- das duas é SECURITY DEFINER, então o risco era baixo — mas a inconsistência
-- some, e a regra passa a valer para todas as funções do schema sem exceção.
-- -----------------------------------------------------------------------------
alter function tocar_updated_at() set search_path = public;
alter function elapsed_ms(matches, timestamptz) set search_path = public;

-- -----------------------------------------------------------------------------
-- 2. EXECUTE: fechar tudo e reabrir só o que o cliente chama
--
-- `revoke ... from public` é o que realmente fecha a porta: PUBLIC é o grant
-- implícito que criou os endpoints. Revogar de anon/authenticated sem revogar
-- de PUBLIC não teria efeito nenhum.
-- -----------------------------------------------------------------------------

-- 2.1 Funções de trigger. Nunca são chamadas diretamente: quem as invoca é o
-- próprio Postgres, ao disparar o trigger, e esse caminho não passa por
-- checagem de EXECUTE (a verificação acontece na criação do trigger).
revoke execute on function atribuir_seq()                     from public, anon, authenticated;
revoke execute on function guardar_evento()                   from public, anon, authenticated;
revoke execute on function validar_evento()                   from public, anon, authenticated;
revoke execute on function gerar_label_partida()              from public, anon, authenticated;
revoke execute on function guardar_factory_admin()            from public, anon, authenticated;
revoke execute on function handle_new_user()                  from public, anon, authenticated;
revoke execute on function preencher_tournament_id_elenco()   from public, anon, authenticated;
revoke execute on function trg_escalar_nova_partida()         from public, anon, authenticated;
revoke execute on function trg_ressincronizar_escalacoes()    from public, anon, authenticated;
revoke execute on function tocar_updated_at()                 from public, anon, authenticated;

-- 2.2 Auxiliares internas. Só são chamadas de dentro de funções SECURITY
-- DEFINER, que rodam como `postgres` — o dono, que mantém EXECUTE de qualquer
-- forma. Fechá-las para o cliente não afeta esse caminho.
revoke execute on function is_factory_admin(uuid)             from public, anon, authenticated;
revoke execute on function is_operador_da_partida(uuid, uuid) from public, anon, authenticated;
revoke execute on function is_jogador_do_torneio(uuid, uuid)  from public, anon, authenticated;
revoke execute on function sincronizar_escalacao(uuid)        from public, anon, authenticated;
revoke execute on function elapsed_ms(matches, timestamptz)   from public, anon, authenticated;
revoke execute on function registrar_auditoria(text, text, uuid, uuid, jsonb, jsonb, text)
  from public, anon, authenticated;

-- 2.3 `is_admin` é a EXCEÇÃO e precisa continuar executável pelo cliente.
--
-- As 32 policies do schema chamam is_admin() na própria expressão, e o
-- Postgres avalia a expressão de uma policy com os privilégios do usuário da
-- sessão — não com os do dono da tabela. Revogar EXECUTE aqui faz TODA
-- consulta a essas tabelas falhar com "permission denied for function
-- is_admin", derrubando o app inteiro. Verificado empiricamente antes desta
-- migration; o linter continuará apontando esta função, e o apontamento é
-- esperado.
--
-- A exposição é aceitável: is_admin(uuid) só devolve um booleano sobre um id
-- que o chamador já precisa conhecer, e user_roles permanece ilegível para
-- quem não é o dono da linha ou administrador.
grant execute on function is_admin(uuid) to anon, authenticated;

-- 2.4 As RPCs que o app realmente chama. Fechadas para PUBLIC e reabertas
-- nominalmente, para que a lista do que ficou exposto viva em um lugar só.
revoke execute on function
  iniciar_partida(uuid), pausar_partida(uuid), retomar_partida(uuid),
  encerrar_partida(uuid), registrar_gol(uuid, match_event_type, uuid, uuid),
  remover_gol(uuid, uuid, text), conceder_papel(uuid, app_role),
  revogar_papel(uuid, app_role), placar_partida(uuid)
  from public, anon, authenticated;

grant execute on function
  iniciar_partida(uuid), pausar_partida(uuid), retomar_partida(uuid),
  encerrar_partida(uuid), registrar_gol(uuid, match_event_type, uuid, uuid),
  remover_gol(uuid, uuid, text), conceder_papel(uuid, app_role),
  revogar_papel(uuid, app_role)
  to authenticated;

-- Placar é leitura pública: o espectador sem conta acompanha a partida (§40).
grant execute on function placar_partida(uuid) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. PRIVILÉGIOS DE TABELA
--
-- Descoberto ao validar a seção 2: nenhuma tabela tinha SELECT/INSERT/UPDATE
-- para anon ou authenticated — apenas REFERENCES/TRIGGER/TRUNCATE. Com isso o
-- PostgREST responderia "permission denied" a qualquer leitura, e as policies
-- da migration inicial nunca chegariam a ser avaliadas.
--
-- Os grants abaixo apenas espelham a matriz de policies já definida. Privilégio
-- de tabela é o TETO do que um papel pode tentar; a RLS continua decidindo
-- linha a linha. Conceder INSERT em teams a `authenticated`, por exemplo, não
-- permite que um jogador comum crie equipes: a policy exige is_admin().
-- -----------------------------------------------------------------------------

-- Conteúdo público do campeonato: o espectador sem conta acompanha tudo (§40).
grant select on tournaments, teams, team_players, phases, matches,
                match_lineups, players to anon, authenticated;

-- Estrutura do campeonato — a policy correspondente exige is_admin().
grant insert, update         on tournaments  to authenticated;
grant insert, update, delete on teams        to authenticated;
grant insert, update, delete on team_players to authenticated;
grant insert, update, delete on phases       to authenticated;
grant insert, update         on players      to authenticated;
grant insert                 on matches      to authenticated;
grant insert, delete         on match_lineups to authenticated;

-- Dados do próprio usuário.
grant select, update on profiles         to authenticated;
grant select         on user_roles       to authenticated;
grant select, insert on rules_acceptance to authenticated;

-- Auditoria: leitura para quem a policy reconhecer como admin; escrita só
-- pelas funções SECURITY DEFINER.
grant select on admin_audit_log to authenticated;

-- O que continua fechado, de propósito:
--   matches            sem UPDATE/DELETE — relógio e status só mudam via RPC
--   match_events       só SELECT — append-only, escrita exclusivamente via RPC
--   app_config         nenhum privilégio — só SECURITY DEFINER lê
--   user_roles         só SELECT — papéis mudam via conceder_papel/revogar_papel
--   rules_acceptance   sem UPDATE/DELETE — o aceite é registro histórico
--   admin_audit_log    só SELECT — a trilha não é forjável nem apagável
