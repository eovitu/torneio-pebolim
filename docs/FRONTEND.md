# Frontend

Estado real da aplicação web depois do redesign de 20/08/2026. Este documento
descreve o que existe, não o que se pretende construir.

---

## 1. Camadas

```
packages/domain          regras do campeonato (puro, testado)
        ↓
apps/web/src/dados       leitura do Supabase + derivação pelo domínio
        ↓
apps/web/src/components  peças de domínio (cartões, tabelas, navegação)
        ↓
apps/web/src/pages       telas
```

`apps/web/src/ui` fica de lado dessa pilha: são peças visuais genéricas, sem
conhecimento de pebolim nem de Supabase.

Regras que valem em todas elas:

- nenhum componente React calcula regra esportiva — placar, classificação,
  estatística e artilharia saem do domínio;
- nenhuma tela lê Supabase direto se já existe um hook em `dados/`;
- nenhum valor de cor, espaço, raio, sombra ou duração é escrito à mão: tudo
  vem de `design-system/tokens.ts`.

## 2. Design system

`apps/web/src/design-system/tokens.ts` é a fonte de verdade visual.

**Identidade:** mesa de pebolim. Verde de feltro (`color.campo`) como base
institucional, laranja da bola (`color.bola` / `color.accent`) como acento de
ação, dourado para liderança e gol de ouro, vermelho reservado a "ao vivo" e a
perigo.

| Grupo | Uso |
| --- | --- |
| `color.campo.*` | identidade, painéis escuros, cabeçalhos |
| `color.bola.*` / `color.accent` | ações primárias, destaque, artilharia |
| `color.aoVivo` | exclusivamente partida acontecendo |
| `color.ouro` | liderança e gol de ouro |
| `fontSize.*` | escala tipográfica — nada de `font-size` solto |
| `radius.*` | de `xs` (6px) a `pill`; não existe mais raio zero |
| `motion.*` | durações e curvas das transições |
| `layout.toque` | 48px, alvo mínimo de toque |
| `zIndex.*` | barra < dropdown < overlay < modal < toast |

`midia.sm/md/lg/xl/ateMd` exporta os `@media` prontos.

### Componentes base (`src/ui`)

| Arquivo | Exporta |
| --- | --- |
| `Botao.tsx` | `Botao`, `BotaoLink`, `BotaoAncora`, `BotaoIcone`, `Acoes` |
| `Superficie.tsx` | `Pagina`, `Cartao`, `Painel`, `Bloco`, `TituloSecao`, `Rotulo`, `Texto`, `Grade`, `Divisor`, `RolagemHorizontal` |
| `Etiqueta.tsx` | `Badge`, `PontoAoVivo`, `Avatar`, `PilhaAvatares` |
| `Estados.tsx` | `Carregando`, `Esqueleto`, `Vazio`, `Erro`, `Sucesso`, `Aviso` |
| `Modal.tsx` | `Modal`, `Confirmacao` |
| `estilos.ts` | `baseBotao`, `cartaoInterativo` (fragmentos de CSS) |

Os fragmentos de CSS vivem em `estilos.ts` e não nos arquivos de componente
porque o Fast Refresh do Vite exige que um módulo de componente exporte apenas
componentes.

### Peças de domínio (`src/components`)

`Cartoes.tsx` (`CartaoDePartida`, `DestaqueAoVivo`, `CartaoDeTorneio`,
`CartaoDeTime`, `LinhaDeJogador`, `Numero`, `GradeDeNumeros`),
`Tabelas.tsx` (`Classificacao`, `Artilharia`), `Navegacao.tsx`,
`ModalRegras.tsx`, `PortaoDeRegras.tsx`, `Formulario.tsx`, `Admin.tsx`
(`RotaAdmin`).

## 3. Navegação

Dois layouts propositais, não um espremido no outro:

- **celular** — barra inferior fixa ao alcance do polegar:
  Início · Torneios · Times · Partidas · Perfil (+ Admin para administradores);
- **desktop** — barra superior com os mesmos destinos e a marca à esquerda.

Esconder o item de Admin é conveniência de interface; quem barra o acesso é a
RLS e o `is_admin()` de cada função do banco.

## 4. Rotas

URLs em inglês, interface em português.

| Rota | Tela | Acesso |
| --- | --- | --- |
| `/` | Boas-vindas | pública (redireciona quem tem sessão) |
| `/home` | Central do campeonato | pública |
| `/login`, `/register` | Autenticação | pública |
| `/tournaments` | Lista de torneios | pública |
| `/tournaments/:id` | Torneio completo | pública |
| `/teams` | Meus times | exige sessão para ter conteúdo |
| `/teams/:id` | Time | pública |
| `/matches` | Minhas partidas | exige sessão para ter conteúdo |
| `/matches/:id` | Partida ao vivo | pública |
| `/players/:id` | Perfil público do jogador | pública |
| `/profile` | Perfil próprio | exige sessão |
| `/rules` | Regras oficiais | pública |
| `/admin` | Hub administrativo | `RotaAdmin` |
| `/admin/tournaments` | Torneios (admin) | `RotaAdmin` |
| `/admin/tournaments/:id` | Condução do torneio | `RotaAdmin` |
| `/admin/users` | Contas | `RotaAdmin` |

Tudo além das telas de entrada é carregado sob demanda (`React.lazy`). A área
administrativa nunca pesa no download de quem não é administrador.

## 5. Camada de dados

`src/dados/campeonato.ts`

- `buscarCru(tournamentId)` — busca as linhas de um torneio. Eventos e
  escalações são filtrados pelos ids das partidas daquele torneio; nunca se
  carrega a tabela inteira.
- `derivar(cru)` — aplica o domínio e devolve `Campeonato` com classificação,
  artilharia, estatísticas de equipe e de jogador e placar por partida.
- `descreverErro`, `estaAoVivo`, `ROTULO_STATUS_*`.

`src/dados/hooks.ts`

| Hook | Realtime | Uso |
| --- | --- | --- |
| `useTorneios()` | não | lista com contagens |
| `useCampeonato(id, comRealtime?)` | sim | página do torneio, time |
| `usePainel()` | sim | Home |
| `useMeuJogador()` | não | `players` da conta logada |
| `useMeusTimes()` | não | `/teams` |
| `useMinhasPartidas()` | sim | `/matches` |
| `useJogadorPublico(id)` | não | perfil público e campanha do perfil próprio |

`src/partida/usePartida.ts` continua sendo o hook da tela de partida, agora
expondo também `sincronizado`.

## 6. Realtime

Os hooks com realtime assinam `match_events` e `matches` e expõem
`sincronizado`. Quando o canal cai, a tela **avisa** e oferece atualizar — não
existe tela que finja tempo real. Há duas redes de segurança: reassinatura do
canal e recarga ao voltar o foco ou a conexão.

Não há polling em lugar nenhum.

## 7. Estados

Toda tela importante trata quatro estados com as mesmas peças:
`Carregando` (esqueleto), `Vazio` (com chamada para ação), `Erro`
(`role="alert"`) e `Sucesso` (`role="status"`).

## 8. Formação das equipes

Regra do proprietário (20/08/2026): o torneio se divide pelo número de
inscritos, e não por um total escolhido na criação.

- no máximo **2 pessoas por equipe**;
- só forma duplas se sobrarem **ao menos duas** — com menos que isso o
  campeonato inteiro seria uma dupla contra um sozinho, então todos jogam
  sozinhos;
- número ímpar com as duplas fechadas deixa **uma equipe de 1**, e isso é
  permitido.

A fonte de verdade é `comporEquipes` em `packages/domain/src/teams.ts`, coberta
por teste; `composicao_de_equipes` no banco é o espelho dela, e a interface usa
a do domínio só para mostrar a prévia antes do sorteio.

`tournaments.max_equipes` e `jogadores_por_equipe` deixaram de ser um alvo a
atingir: passaram a **registrar** o que o sorteio formou, e são preenchidos por
ele. A criação de torneio não pergunta mais formato.

## 9. Armadilhas já pagas

Duas coisas quebraram no primeiro uso real e estão travadas por teste:

- **Corpo de modal não rolava.** Item flex sem `min-height: 0` não encolhe; a
  caixa estourava a altura máxima e o rodapé, com o botão de confirmar, saía da
  tela. No modal de regras isso travava o app inteiro. Todo contêiner rolável
  dentro de um flex precisa de `min-height: 0`.
- **Teclado do celular fechando a cada letra.** O efeito de abertura do modal
  dependia da callback `aoFechar`, recriada a cada render; cada tecla
  reexecutava o efeito e devolvia o foco ao diálogo. Callback em efeito de
  ciclo de vida vai por `ref`, não por dependência.

## 10. Acessibilidade

- alvo de toque mínimo de 48px (`layout.toque`);
- campos com 16px de fonte, para não disparar o zoom do iOS;
- foco visível global em `:focus-visible`;
- `prefers-reduced-motion` desliga toda animação de uma vez;
- nenhuma informação depende só de cor — "ao vivo" tem ponto pulsante **e** a
  palavra escrita; empate sem critério aparece rotulado.

## 11. Performance

- `React.lazy` em todas as rotas fora do caminho de entrada;
- `manualChunks` separa React, Supabase, styled-components e ícones, para que
  uma mudança de tela não invalide o cache dos vendors;
- consultas escopadas por torneio;
- realtime só onde há motivo.

## 12. Testes

| Arquivo | Cobre |
| --- | --- |
| `components/ModalRegras.test.tsx` | trava de rolagem do aceite |
| `auth/AuthProvider.test.tsx` | ciclo de vida da confirmação das regras |
| `ui/Modal.test.tsx` | rolagem, z-index e foco dos modais (regressões reais) |
| `components/PortaoDeRegras.test.tsx` | obrigatoriedade das regras por sessão |
| `pages/telas.test.tsx` | fumaça: todas as telas principais montam com banco vazio |

As regras do campeonato continuam cobertas em `packages/domain/test`.
