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

## Regras do campeonato

As regras oficiais são versionadas em
[`packages/domain/src/rules.ts`](packages/domain/src/rules.ts) (`RULES_VERSION`).
A página de regras e o aceite no cadastro renderizam a partir dessa mesma
fonte, de modo que o texto exibido e o comportamento do sistema nunca divergem.

Resumo do que o domínio garante:

| Regra | Valor |
| --- | --- |
| Duração da partida | 180 segundos — ou uma meta de gols, se o organizador escolher |
| Gol normal | 1 |
| Gol de goleiro | 2 |
| Gol contra | 1 (credita o adversário; nunca vale 2) |
| Vitória / empate / derrota | 3 / 1 / 0 pontos |
| Empate no mata-mata | Gol de ouro, cronômetro progressivo, sem limite |
| Desempate na tabela | Pontos, saldo de gols, confronto direto |
| Fim da fase de grupos | Automático: a última partida encerrada fecha a fase e monta a chave |
| Corte para o mata-mata | As N melhores, N = maior potência de 2 ≤ número de equipes |
| Semeadura da chave | 1º × último, 2º × penúltimo |
| Disputa de 3º lugar | Entre os perdedores da semifinal, quando ela existe |
| Grande final | Melhor de 2 jogos; 1×1 leva a um terceiro jogo |
| Pódio | Ouro, prata e bronze na equipe e no perfil de cada jogador, cada posição premiada assim que é decidida |
| Artilheiro | Troféu próprio, concedido só no encerramento do torneio; empate premia todos |

## Documentação

| Documento | Conteúdo |
| --- | --- |
| [`docs/FRONTEND.md`](docs/FRONTEND.md) | Design system, navegação, rotas, camada de dados, realtime e testes da web |
| [`docs/PERMISSOES.md`](docs/PERMISSOES.md) | Quem pode o quê, onde cada permissão é validada e as regras de inscrição e de aceite |
| `supabase/migrations/` | Modelo de dados, RLS e funções — cada arquivo documenta a própria decisão |

Ainda não escritos: `ARCHITECTURE.md`, `DATABASE.md`, `SECURITY.md`,
`CONTRIBUTING.md`, `CHANGELOG.md`, `IMPLEMENTATION_STATUS.md`.

## Estado da implementação

| Área | Situação |
| --- | --- |
| Domínio das regras | coberto por `npm run verify` (a contagem é apresentada pelo Vitest) |
| Schema, RLS, funções e auditoria | no ar |
| Auth, perfis e Storage de avatares | no ar |
| Realtime da partida | no ar |
| Frontend — navegação, Home, torneios, times, partidas, perfis, admin | no ar |
| Autoinscrição em torneio | no ar |
| Aceite obrigatório das regras por sessão | no ar |

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

Validação local em **07/10/2026**: `npm run verify` passou (153 testes de
domínio e 36 web), `npm run build` passou, `npm run test:edge` passou (9),
`npm run test:db` passou (20 assertions em 1 arquivo, após replay de todas as
30 migrations) e `npm audit` reportou 0 vulnerabilidades.

---

## Autoria

**Victor Hugo** — [@eovitu](https://github.com/eovitu)

Repositório: <https://github.com/eovitu/torneio-pebolim>

Copyright © Victor Hugo (eovitu)
