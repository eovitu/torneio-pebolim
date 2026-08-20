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
| Ajustar equipes × jogadores | admin, **a qualquer momento** | `tournaments_update_admin` (o trigger só guarda `status`) |
| Sortear equipes | admin | `sortear_equipes` |
| Criar fases / partidas | admin | `phases_*`, `criar_partida_mata_mata`, `gerar_partidas_grupo` |
| Entrar em um torneio | qualquer conta | `inscrever_se_no_torneio` |
| Sair de um torneio | a própria pessoa | `sair_do_torneio` |
| Iniciar partida | jogador do torneio ou admin | `iniciar_partida` |
| Gol / gol de goleiro / gol contra | jogador escalado, juiz ou admin | `registrar_gol` → `is_operador_da_partida` |
| Remover gol | idem | `remover_gol` |
| Pausar / retomar / encerrar | idem | RPCs correspondentes |
| Personalizar time | admin | `teams_update_admin` |
| Editar perfil / trocar senha | a própria pessoa | `profiles_update_proprio`, Supabase Auth |
| Trocar foto | a própria pessoa | policy do Storage por pasta = `auth.uid()` |
| Criar contas | admin | Edge Function `admin-criar-usuario` |
| Vincular jogador a conta | admin | `vincular_jogador_conta` |
| Excluir torneio | admin, e só sem nenhuma partida | `excluir_torneio` |

`matches` não tem policy de UPDATE para ninguém: status e relógio mudam
exclusivamente pelas RPCs, com `now()` do servidor. `match_events` é
append-only para todos — corrigir é inserir um evento novo.

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

## 5. Aceite das regras

Duas coisas diferentes, de propósito:

| | Onde vive | Quando |
| --- | --- | --- |
| Histórico permanente | tabela `rules_acceptance` | uma linha por (usuário, versão) |
| Exibição obrigatória | memória do `AuthProvider` | **toda sessão/login** |

Decisão do proprietário (20/08/2026): como a maioria das contas é criada em
Admin → Contas e essas pessoas nunca passam pelo cadastro, o modal de regras
aparece a cada entrada no app. `PortaoDeRegras` bloqueia até a confirmação — sem
botão de cancelar e sem Esc.

A confirmação **não** é persistida em `localStorage`: sobreviver ao logout
furaria a regra. Sair, trocar de conta ou expirar a sessão zera a confirmação.

Ao confirmar, o aceite da versão vigente é gravado em `rules_acceptance` se
ainda não existir — é assim que contas criadas pelo administrador passam a ter
registro.

## 6. O que a interface NÃO decide

- se você pode operar uma partida — `is_operador_da_partida`;
- se você é administrador — `is_admin`;
- se a inscrição está aberta — `inscrever_se_no_torneio`;
- se um torneio pode ser excluído — `excluir_torneio` conta as partidas;
- qual o placar — os eventos, sempre.
