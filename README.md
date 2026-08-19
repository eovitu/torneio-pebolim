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
| Duração da partida | 180 segundos |
| Gol normal | 1 |
| Gol de goleiro | 2 |
| Gol contra | 1 (credita o adversário; nunca vale 2) |
| Vitória / empate / derrota | 3 / 1 / 0 pontos |
| Empate no mata-mata | Gol de ouro, cronômetro progressivo, sem limite |
| Desempate na tabela | Pontos, depois saldo de gols |

## Documentação

| Documento | Conteúdo |
| --- | --- |
| `ARCHITECTURE.md` | Arquitetura da aplicação e do Supabase |
| `DATABASE.md` | Modelo de dados e migrations |
| `SECURITY.md` | Auth, RLS, Storage e tratamento de secrets |
| `CONTRIBUTING.md` | Padrões de código e de commit |
| `CHANGELOG.md` | Histórico de versões |
| `IMPLEMENTATION_STATUS.md` | O que está pronto e o que falta |

---

## Autoria

**Victor Hugo** — [@eovitu](https://github.com/eovitu)

Repositório: <https://github.com/eovitu/torneio-pebolim>

Copyright © Victor Hugo (eovitu)
