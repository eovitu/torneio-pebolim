-- =============================================================================
-- TROFÉU DE ARTILHEIRO — schema
--
-- Decisão do proprietário (28/08/2026): existe um troféu exclusivo para o
-- artilheiro do torneio, e ele só é concedido quando o torneio é ENCERRADO.
--
-- Por que só no encerramento, e não junto do pódio: artilharia é a soma de
-- tudo. Enquanto houver uma partida por jogar, o artilheiro pode mudar — e um
-- troféu que troca de dono não é troféu. O pódio pode ser premiado antes porque
-- cada posição dele é decidida por um confronto que já terminou.
--
-- DUAS MUDANÇAS DE SCHEMA, EM ARQUIVO PRÓPRIO
--
-- `alter type ... add value` não pode compartilhar transação com o uso do valor
-- novo: o enum precisa estar comitado antes. Mesmo motivo que separou
-- 20260820250000 de 20260820250001.
--
-- A `unique (tournament_id, player_id)` também sai daqui. Ela dizia "um jogador
-- não sobe duas vezes no mesmo pódio", o que continua verdade — mas artilharia
-- não é posição de pódio. Quem for campeão E artilheiro tem direito aos dois
-- troféus, e a constraint antiga barrava o segundo. A regra correta é uma por
-- POSIÇÃO, não uma por torneio.
-- =============================================================================

alter type trofeu_posicao add value if not exists 'ARTILHEIRO';

alter table trofeus drop constraint if exists trofeus_tournament_id_player_id_key;
alter table trofeus add constraint uq_trofeu_por_posicao
  unique (tournament_id, player_id, posicao);

-- -----------------------------------------------------------------------------
-- `trofeus` nasceu invisível: policy sem GRANT.
--
-- A tabela subiu com RLS e uma policy de leitura pública, e mesmo assim nenhum
-- troféu aparecia na tela. A policy nunca chegou a ser avaliada: sem GRANT de
-- SELECT, o PostgREST é barrado pelo privilégio de tabela ANTES da RLS e
-- responde "permission denied".
--
-- É o mesmo defeito que 20260819230715 já tinha pago e documentado — RLS e
-- GRANT são duas camadas, e passar por uma não dispensa a outra. A migration
-- que criou `trofeus` lembrou da policy e esqueceu do grant. Leitura apenas,
-- para os mesmos papéis que já leem `teams` e `players`; escrever continua
-- sendo privilégio das funções.
-- -----------------------------------------------------------------------------
grant select on trofeus to anon, authenticated;
