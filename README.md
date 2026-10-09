# Torneio Pebolim

Plataforma de campeonatos de pebolim: torneios, equipes, jogadores, partidas ao
vivo, classificação, artilharia e estatísticas.

Frontend em React + TypeScript hospedado na **Vercel**; **Supabase** como
backend (PostgreSQL, Auth, Realtime, Storage).

---

## Estrutura

```
torneio-pebolim/
├── apps/web/           Aplicação React + TypeScript + Vite + Styled Components
├── packages/domain/    Regras de negócio puras — fonte de verdade do domínio
└── project/            Protótipo de referência visual (Claude Design)
```

O pacote `@pebolim/domain` não depende de React nem de Supabase. Toda regra do
campeonato — valor dos gols, cronômetro, classificação, artilharia — vive lá e
é coberta por testes.

## Requisitos

- Node.js >= 20

## Instalação

```bash
npm install
```

## Desenvolvimento

```bash
npm run dev          # sobe a aplicação web
npm run verify       # typecheck + lint + testes em todos os workspaces
npm run build        # build de produção
```

## Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha com os dados do seu projeto
Supabase. Nenhum arquivo `.env` é versionado, e a *service role key* nunca deve
receber o prefixo `VITE_`.

## Formatos e regras do campeonato

As regras oficiais são versionadas em
[`packages/domain/src/rules.ts`](packages/domain/src/rules.ts) (`RULES_VERSION`).
A página pública `/rules` renderiza a mesma fonte usada pelo domínio.

O organizador pode configurar fases de três tipos:

| Fase | Regras e progressão |
| --- | --- |
| Grupos (`GROUP`) | Empate permitido; 3/1/0 pontos por vitória/empate/derrota. Ao encerrar a última partida, a fase fecha e cria automaticamente uma fase de mata-mata. |
| Mata-mata (`KNOCKOUT`) | Empate vai a gol de ouro, com cronômetro progressivo sem limite. A chave é montada pela classificação; avançam as melhores equipes em quantidade igual à maior potência de 2 possível (2, 4, 8, 16 ou 32). Havendo semifinal, os perdedores disputam o bronze. A final é uma série melhor de 2 jogos; empate de vitórias leva a um terceiro jogo. |
| Copa (`DOUBLE_ELIMINATION`) | Cada equipe sai após duas derrotas. Quem perde na chave dos vencedores continua na chave dos perdedores. Se o campeão dos perdedores vencer a primeira final, uma segunda final decide o título. O administrador define a ordem inicial da chave. |

Outras regras implementadas:

- Partidas duram 180 segundos por padrão; o organizador pode escolher uma meta de gols antes do início.
- Gol normal vale 1, gol de goleiro vale 2 e gol contra vale 1 para o adversário. Gol contra desconta 1 da artilharia líquida do autor e não reduz o placar do próprio time.
- A classificação desempata por pontos, saldo e confronto direto. Empates restantes compartilham a posição.
- O sorteio exige pelo menos 2 inscritos. Forma duplas só quando há participantes suficientes para pelo menos duas duplas; com 2 ou 3 inscritos, todos jogam sozinhos. A partir daí, cada dupla tem até 2 pessoas, e uma equipe solo pode sobrar quando o total é ímpar. O rodízio após partidas encerradas evita que ela fique sozinha sempre.
- Qualquer conta pode se inscrever diretamente enquanto o torneio está em configuração. A inscrição sai antes do sorteio; depois, a pessoa não pode sair da equipe sorteada.
- Ouro e prata são definidos pela final. Bronze é concedido quando a disputa de terceiro lugar termina. O artilheiro recebe troféu só quando o torneio é encerrado; empates premiam todos.
- Operações de partida e alterações administrativas são autorizadas no banco por RLS e RPCs. A interface não é a fronteira de segurança.

## Documentação

| Documento | Conteúdo |
| --- | --- |
| [`docs/FRONTEND.md`](docs/FRONTEND.md) | Design system, navegação, rotas, camada de dados, realtime e testes da web |
| [`docs/PERMISSOES.md`](docs/PERMISSOES.md) | Quem pode o quê, onde cada permissão é validada e as regras de inscrição e de aceite |
| `supabase/migrations/` | Modelo de dados, RLS e funções — cada arquivo documenta a própria decisão |

## Estado da implementação

| Área | Situação |
| --- | --- |
| Domínio, frontend e Edge Function | verificados localmente: `npm run verify`, `npm run build` e `npm run test:edge` passaram em 09/10/2026; 153 testes de domínio, 28 web e 9 de Edge Function |
| Banco local | 33 migrations aplicadas desde zero; `npm run test:db` passou com 43 assertions em 09/10/2026 |
| Fluxo autenticado local | Em 09/10/2026, teste manual com contas descartáveis cobriu criação pelo organizador, autoinscrição de 2 participantes, sorteio, início do torneio e partida, gols normal e de goleiro, encerramento, classificação e criação automática da chave. Uma conta autenticada fora do torneio viu a partida sem controles; a RPC de gol foi negada pelo banco. Uma segunda sessão recebeu placar em tempo real sem recarregar; a tabela persistiu após recarga. |
| CI no commit publicado | workflow `Verify` passou no SHA `d6ea9495bea9ad28b0f9f2d6e5326824225a91ff` em 08/10/2026 |
| Páginas públicas hospedadas | Em 09/10/2026, Home exibiu classificação, artilharia e partidas; a lista mostrou torneios e links de detalhe; `/rules` exibiu a versão 1.1.0. A rota de detalhe abriu classificação e partidas sem login. Navegação verificada em viewport de 390 × 844 px. |

## Limites e verificações pendentes

Os checks locais provam que o código e as migrations versionadas passam nas
suítes automatizadas; não provam que o banco Supabase hospedado está na mesma
versão. Não foi possível confirmar o histórico de migrations instalado no
projeto remoto nem executar operações autenticadas nele.

Durante a inspeção hospedada, dados públicos reais foram lidos sem login. Não
foram alterados. A leitura pública confirma o caminho de visualização; o fluxo
autenticado e o realtime foram testados apenas na stack local descartável. Isso
não comprova a autorização de escrita, o realtime ou as migrations do Supabase
hospedado. Estes itens ainda precisam ser verificados em um ambiente hospedado
de teste, usando contas e dados descartáveis:

- criar torneio, inscrever participantes, sortear equipes, iniciar fases e partidas;
- registrar, corrigir e remover gols; conferir classificação e progressão das chaves;
- verificar ações como visitante, participante, juiz e administrador;
- observar atualizações entre duas sessões e após recarregar a página;
- conferir links públicos em celular e abrir torneios privados sem autorização;
- comparar migrations locais com as migrations registradas no Supabase hospedado.

A verificação manual local não é uma suíte automatizada nem cobre todas as
combinações de papéis. A cobertura pgTAP tem 43 assertions representativas de
RLS e RPCs; não cobre todas as combinações de políticas nem substitui a
conferência do ambiente publicado.

## Verificação local de segurança

O projeto local do Supabase usa `project_id` e portas próprios, sem seed. Para
subir uma stack isolada, aplicar todas as migrations desde zero e executar a
suíte pgTAP:

```bash
npx --yes supabase@2.120.0 start
npx --yes supabase@2.120.0 db reset --local --no-seed
npm run test:db
npx --yes supabase@2.120.0 stop --no-backup
```

`npm run test:edge` executa os testes da Edge Function com Deno 2.9.6 pinado.
`npm run verify`, `npm run build` e `npm audit` cobrem os workspaces, o build
de produção e as dependências npm. A suíte SQL usa usuários fictícios em uma
transação revertida; ela cobre políticas representativas, não promete cobertura
total de RLS nem valida permissões instaladas em produção.

Snapshot de validação local em **07/10/2026**: `npm run verify` passou (153
testes de domínio e 36 web), `npm run build` passou, `npm run test:edge` passou
(9), `npm run test:db` passou (20 assertions em 1 arquivo, após replay de todas
as 30 migrations) e `npm audit` reportou 0 vulnerabilidades.

Validação integrada em **08/10/2026**: `npm ci` instalou 277 pacotes e
`npm audit` reportou 0 vulnerabilidades; `npm run verify` passou (153 testes de
domínio e 28 web), `npm run build` passou e `npm run test:edge` passou (9).
`npm run test:db` passou com 43 testes após replay no CI 37760728672. Os três
arquivos de migration foram depois renomeados para as versões registradas pelo
Supabase; seus hashes SHA-256 permaneceram iguais. O replay não foi repetido
após os renames.

---

## Autoria

**Victor Hugo** — [@eovitu](https://github.com/eovitu)

Repositório: <https://github.com/eovitu/torneio-pebolim>

Copyright © Victor Hugo (eovitu)
