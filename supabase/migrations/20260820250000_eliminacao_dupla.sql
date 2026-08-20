-- =============================================================================
-- ELIMINAÇÃO DUPLA — A "COPA"
--
-- Mecânica confirmada pelo proprietário em 20/08/2026:
--
--   - todo mundo começa na CHAVE DOS VENCEDORES;
--   - quem perde na chave dos vencedores NÃO é eliminado: cai para a CHAVE DOS
--     PERDEDORES e continua disputando;
--   - quem perde na chave dos perdedores está eliminado — segunda derrota;
--   - a FINAL junta o campeão dos vencedores com o campeão dos perdedores;
--   - RESET NA FINAL: se o campeão dos perdedores vencer a final, os dois
--     passam a ter uma derrota cada e joga-se uma SEGUNDA final, que decide o
--     título. Se o campeão dos vencedores ganhar, acabou — ele seguiria
--     invicto e a segunda final não existe.
--
-- A fonte de verdade da regra é `packages/domain/src/eliminacaoDupla.ts`,
-- coberta por teste. O que existe aqui é o espelho dela: a interface não pode
-- ser a única a conhecer o desenho da chave (§45).
--
-- Empate continua resolvido pelo §37: eliminação dupla é mata-mata, e empate
-- no tempo regulamentar vai para o Gol de Ouro. Enquanto não houver vencedor,
-- a chave simplesmente não anda.
--
-- Semeadura: a ORDEM das equipes no chaveamento é escolhida pelo
-- administrador. O sistema não inventa critério de semeadura — isso seria
-- regra de campeonato que ninguém definiu (§67). Sem escolha, é alfabética,
-- que é determinística e não simula mérito.
--
-- NOTA DE APLICAÇÃO: no banco esta migration foi aplicada em partes
-- (`tipo_de_fase_eliminacao_dupla`, `colunas_do_chaveamento`,
-- `montar_eliminacao_dupla`, `ocupante_do_slot`, `avancar_eliminacao_dupla`,
-- `gerar_eliminacao_dupla`, `encerrar_partida_avanca_a_chave` e os grants),
-- porque `alter type ... add value` não pode compartilhar transação com o uso
-- do valor novo. O conteúdo é o mesmo, na mesma ordem.
-- =============================================================================

alter type phase_kind add value if not exists 'DOUBLE_ELIMINATION';

alter table phases  add column chaveamento jsonb;
alter table matches add column slot text;

create unique index uq_matches_slot_por_fase on matches (phase_id, slot)
  where slot is not null;
