# Permissões e acesso

Estado real do que o banco permite. A interface apenas reflete estas regras —
esconder um botão nunca é segurança (§45).

---

## 1. Quem é quem

| Papel | Origem |
| --- | --- |
| Visitante | sem sessão |
| Jogador (`PLAYER`) | atribuído no cadastro pelo trigger `handle_new_user` |
| Administrador (`ADMIN`) | concedido por `conceder_papel` |
| Administrador de fábrica (`FACTORY_ADMIN`) | e-mail configurado em `app_config`; nunca do frontend |

## 2. Leitura pública (RLS `to anon, authenticated`)

`tournaments`, `teams`, `team_players`, `tournament_participants`, `phases`,
`matches`, `match_lineups`, `match_events` e `players` — sempre limitados a
torneios com `publico = true` (`players` é público sem condição: nome e foto
aparecem em escalação, artilharia e histórico).

É isto que sustenta as telas públicas: Home, torneios, times, partida ao vivo e
**perfil público do jogador**. `profiles` continua privado — o perfil público é
montado sobre `players`, e nem e-mail nem data de nascimento saem de lá.

## 3. Escrita

| Ação | Quem | Onde é validado |
| --- | --- | --- |
| Criar/configurar torneio | admin | policy `tournaments_*_admin` |
| Sortear equipes | admin | `sortear_equipes` |
| **Começar o torneio** | admin **ou qualquer inscrito**, com ≥2 pessoas | `iniciar_torneio` |
| Decidir o rodízio | **o juiz da partida** (quem a iniciou) ou admin | `resolver_rodizio` |
| Desfazer o sorteio | admin, e só sem nenhuma partida | `desfazer_sorteio` |
| Criar fases / partidas | admin | `phases_*`, `criar_partida_mata_mata`, `gerar_partidas_grupo` |
| Gerar a chave da Copa | admin | `gerar_eliminacao_dupla` |
| Montar as equipes a mao | admin | `formar_equipes_manual` |
| Guardar um time para sempre | admin ou quem joga nele | `salvar_equipe_como_clube` |
| Entrar em um torneio | qualquer conta | `inscrever_se_no_torneio` |
| Sair de um torneio | a própria pessoa | `sair_do_torneio` |
| Iniciar partida | jogador do torneio ou admin | `iniciar_partida` |
| Gol / gol de goleiro / gol contra | jogador escalado, juiz ou admin | `registrar_gol` → `is_operador_da_partida` |
| Remover gol | idem | `remover_gol` |
| Pausar / retomar / encerrar | idem | RPCs correspondentes |
| **Zerar a partida** | idem | `resetar_partida` |
| Refazer a escalação de uma partida | admin | `ressincronizar_escalacao` |
| Personalizar time (nome, descrição, cor, escudo) | admin **ou quem joga naquele time** | `teams_update_admin_ou_integrante` + grant por coluna |
| Editar perfil / trocar senha | a própria pessoa | `profiles_update_proprio`, Supabase Auth |
| Trocar foto | a própria pessoa | policy do Storage por pasta = `auth.uid()` |
| Criar contas | admin | Edge Function `admin-criar-usuario` |
| Vincular jogador a conta | admin | `vincular_jogador_conta` |
| Excluir torneio | admin, e só sem partida **disputada** | `excluir_torneio` |

Em `teams`, a policy decide QUAIS linhas cada um altera e o grant por coluna
decide QUAIS campos: só `nome`, `descricao`, `logo_url` e `cor_primaria` são
graváveis pelo cliente. Sem o grant, uma policy de UPDATE deixaria mexer em
`tournament_id` e mudar a equipe de campeonato — RLS não filtra coluna.

`tournament_participants` tem policy **e** grant de INSERT/DELETE. Faltava o
grant até 20/08/2026, e sem ele a policy nunca chegava a ser consultada: o
Postgres barra pela falta de privilégio antes de olhar a RLS. Era isso que
fazia a inscrição pelo painel de administração não gravar.

`is_participante_do_torneio(uuid, uuid)` é auxiliar interna usada por
`iniciar_torneio` sob `SECURITY DEFINER`. A migration
`20261008024238_restringe_rpc_participacao_torneio.sql` revoga `EXECUTE` de
`PUBLIC`, `anon` e `authenticated`; o cliente só pode usar a RPC
`iniciar_torneio`, que deriva a identidade de `auth.uid()` e verifica a
inscrição antes de qualquer transição.

Na criação administrativa de conta, Auth e PostgreSQL não formam uma transação
única. Se Auth criar a conta e a gravação de `admin_audit_log` falhar, a Edge
Function mantém a conta, retorna sucesso com um aviso explícito e registra um
warning sem email, senha ou mensagem interna do banco. A tela informa que a
conta existe e orienta a não repetir a criação; a auditoria fica pendente para
tratamento administrativo.

`matches` não tem policy de UPDATE para ninguém: status e relógio mudam
exclusivamente pelas RPCs, com `now()` do servidor. `match_events` é
append-only para todos — corrigir é inserir um evento novo.

O agregado `placar_partida(uuid)` herda o RLS do chamador. Visitante e jogador
veem o resultado de partidas públicas; em partida privada recebem `0–0`, pois
a linha da partida e seus eventos ficam invisíveis. Administradores continuam
vendo o placar privado. `rodizio_sugerido(uuid)` exige autenticação e, antes de
calcular ou retornar nomes/equipes, limita a leitura a torneio público ou
administrador, igual às policies das tabelas. Em jogo privado, `resolver_rodizio`
valida primeiro o juiz/iniciador ou administrador e usa o cálculo interno só
para efetivar essa decisão; a RPC de sugestão continua sem retornar o roster ao
cliente não-admin.

## 4. Inscrição em torneio

Decisão do proprietário (20/08/2026):

- **autoinscrição direta**, sem aprovação do administrador;
- aberta **somente** enquanto o torneio está em `CONFIGURACAO`.

`inscrever_se_no_torneio` cria a linha em `players` para quem ainda não tem uma
(um jogador por conta, reaproveitado entre torneios) e registra a inscrição em
`tournament_participants`. O sorteio continua sendo um ato explícito do
administrador — a lista só chega até ele já pronta.

O administrador continua podendo inscrever quem não tem conta, pelo nome.

Sair só é possível enquanto as inscrições estão abertas e antes de ter sido
sorteado em uma equipe.

## 5. Rodízio de quem joga sozinho

Regra do proprietário (20/08/2026). Com número ímpar, uma equipe fica com uma
pessoa só e ninguém pode ficar sozinho o campeonato inteiro. Depois de cada
partida encerrada, quem PERDEU empresta um jogador para o solitário; quem sobra
na perdedora passa a ser o sozinho da vez.

- vai quem **já ficou mais vezes sozinho** — ele escapa do solo e a vez passa
  ao companheiro; desempate por quem menos formou dupla com o solitário atual;
- se quem perdeu foi a própria equipe de um, **nada muda**;
- acontece **a cada partida encerrada**;
- quem confirma é o **juiz daquela partida**, não o administrador. Recusar
  também resolve: a composição segue e a tela para de perguntar.

A regra vive em `packages/domain/src/rodizio.ts`; `rodizio_sugerido` no banco é
o espelho dela mais a contagem do histórico.

**Partidas encerradas são imutáveis.** `match_lineups` é um retrato por
partida, e o rodízio só reescreve a escalação das partidas ainda AGENDADAS —
via `trg_30_ressincronizar_escalacoes`. Quem jogou, jogou.

## 6. Nome e foto: `profiles` privado, `players` público

`profiles` é privado (só o dono e o admin leem). `players` é o que aparece
publicamente — em escalação, artilharia, histórico e perfil público.

O gatilho `trg_50_sincronizar_jogador` copia de `profiles` para `players`
exatamente os dois campos que já eram públicos: **nome** e **foto**. Nada que
era privado passa a ser visível; e-mail e data de nascimento nunca saem de
`profiles`.

Ele vive no banco, e não no navegador, porque a sincronização precisa valer
para todas as portas: a tela de perfil, a criação do jogador pela
autoinscrição, ou qualquer alteração futura. Quando isso era feito no cliente,
quem nunca abriu a tela de perfil aparecia na artilharia com o nome do cadastro
e sem foto.

`players.foto_url` só é sobrescrita quando o perfil tem foto, para não apagar a
imagem que o organizador possa ter posto em um jogador sem conta.

## 7. Aceite das regras

Duas coisas diferentes, de propósito:

| | Onde vive | Quando |
| --- | --- | --- |
| Histórico permanente | tabela `rules_acceptance` | uma linha por (usuário, versão) |
| Aceite obrigatório | formulário de cadastro | depois de ler até o fim e confirmar |
| Consulta manual | página pública `/rules` | quando a pessoa abre pelo link ou pela rota |

No cadastro, marcar a opção abre o modal. O aceite só acontece após a leitura
até o fim e confirmação explícita. Login, restauração de sessão, troca de conta
e renovação de token não abrem esse modal nem criam aceite por si; o provedor
somente pode reconciliar uma versão que um cadastro anterior já registrou nos
metadados. A página `/rules` e seus links continuam disponíveis para consulta
manual; apenas lê-la não registra aceite.

O cadastro envia a versão aceita em `user_metadata.accepted_rules_version`.
Quando houver sessão ativa, o provedor reconcilia esse metadata com
`rules_acceptance` usando gravação idempotente. Sem a versão previamente aceita
no metadata, a autenticação não grava uma linha nessa tabela.

## 8. O que a interface NÃO decide

- se você pode operar uma partida — `is_operador_da_partida`;
- se você é administrador — `is_admin`;
- se a inscrição está aberta — `inscrever_se_no_torneio`;
- se um torneio pode ser excluído — `excluir_torneio` conta as partidas;
- se você pode editar aquele time — `teams_update_admin_ou_integrante`;
- qual o placar — os eventos, sempre.

## 9. Escalação da partida

`match_lineups` sustenta três coisas ao mesmo tempo: os botões de gol por
jogador, `validar_evento` (o autor precisa estar escalado NAQUELA equipe) e
`is_operador_da_partida` (quem joga pode operar). Uma partida sem escalação não
aceita gol nenhum, e a tela ficava só com o botão de gol contra — que abre um
modal vazio.

Passou a haver garantia em três pontos:

- `garantir_escalacao` preenche a escalação quando ela está **vazia** — nunca
  quando é parcial, porque escalação parcial pode ser um retrato legítimo e
  partida encerrada é imutável;
- `iniciar_partida` chama essa garantia antes de soltar o relógio, e recusa
  começar se as equipes realmente não tiverem jogadores;
- `ressincronizar_escalacao` é a intervenção do administrador para uma partida
  já em curso, e fica na auditoria.

## 10. Zerar a partida

Decisão do proprietário (20/08/2026): a partida que travou volta ao início.

`resetar_partida` devolve a partida a AGENDADA, zera o relógio e **anula** os
gols já registrados — cada um recebe um `GOAL_REMOVED` com o motivo "Partida
zerada". Nada é apagado (§29/§51): o histórico continua inteiro, riscado.

Quem pode é quem opera a partida (`is_operador_da_partida`), e não só o
administrador — quem está com o celular na mão é quem precisa da saída.
Partida ENCERRADA não é zerada por aqui: o resultado já valeu para a
classificação, e desfazê-lo é correção administrativa.

## 11. Times permanentes (clubes)

`teams` continua sendo a PARTICIPAÇÃO de um time em um torneio — é sobre ela
que a classificação, as partidas e as escalações daquele campeonato se apoiam.
`clubs` é a identidade que atravessa campeonatos: nome, escudo, descrição, cor
e a dupla permanente.

```
clubs            identidade permanente
  ^ club_id
teams            participação daquele clube em UM torneio
```

Nenhuma regra esportiva mudou: somar a campanha do clube é somar as
participações, e o domínio já agrega qualquer conjunto de partidas.

`clubs` e `club_members` têm leitura pública e **nenhum** grant de escrita para
o cliente: tudo passa por RPC com SECURITY DEFINER. Personalizar a participação
propaga para o clube por gatilho, para que a personalização não se perca entre
campeonatos.

## 12. Formatos de fase

| `phase_kind` | Empate | Como as partidas nascem |
| --- | --- | --- |
| `GROUP` | permitido (§36) | `gerar_partidas_grupo`, todas de uma vez |
| `KNOCKOUT` | vai a Gol de Ouro (§37) | `criar_partida_mata_mata`, uma a uma |
| `DOUBLE_ELIMINATION` | vai a Gol de Ouro (§37) | `gerar_eliminacao_dupla` monta a chave; `avancar_eliminacao_dupla` cria os confrontos seguintes sozinho |

A eliminação dupla é a "Copa", confirmada pelo proprietário em 20/08/2026:
quem perde na chave dos vencedores cai para a dos perdedores e continua; sai
quem perde a segunda vez; a final junta os dois campeões; e se o campeão dos
perdedores vencer a final, joga-se uma **segunda final**.

A regra vive em `packages/domain/src/eliminacaoDupla.ts`, coberta por teste; o
banco é o espelho dela. A ORDEM do chaveamento é escolha do administrador — o
sistema não inventa critério de semeadura (§67).

## Verificação de segurança local

`npm run test:edge` usa Deno 2.9.6 pinado para validar autenticação, papel
administrativo, JSON, criação, sanitização de falhas e auditoria pendente.
Para o banco, use a stack local isolada de `supabase/config.toml`:

```bash
npx --yes supabase@2.120.0 start
npx --yes supabase@2.120.0 db reset --local --no-seed
npm run test:db
npx --yes supabase@2.120.0 stop --no-backup
```

A suíte pgTAP usa UUIDs reservados e faz rollback. São 43 assertions sobre
casos representativos: leitura pública/privada, placar e rodízio, perfis,
papéis/auditoria, grants de equipe, escrita direta em partidas e a fronteira
entre RPCs internas e públicas. Isso não mede 100% da RLS nem comprova o estado
instalado em produção.
