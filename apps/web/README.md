# apps/web

Aplicação React do Torneio Pebolim.

- **React 19 + TypeScript** (modo estrito)
- **Vite** para dev server e build
- **Styled Components** com os tokens em `src/design-system/`
- **Supabase** como backend (client, Auth, Realtime, Storage)

As regras do campeonato **não** vivem aqui — elas estão em
[`@pebolim/domain`](../../packages/domain). Este app renderiza e consome; a
autoridade final sobre os dados é o PostgreSQL do Supabase, com RLS.

## Scripts

```bash
npm run dev         # dev server
npm run build       # typecheck + build de produção
npm run typecheck   # apenas typecheck
npm run lint        # eslint (zero warnings)
npm run test        # vitest
```

Copyright © Victor Hugo (eovitu)
