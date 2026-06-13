# CRE Deals (credeals.io)

A commercial real-estate **deal-lifecycle simulator and learning game**. Players source deals, run
napkin and detailed underwriting, negotiate an LOI and PSA, drive a contract-to-close, and operate the
asset — while a game engine tracks cash, time, reputation, and career progression. The same engine powers
a **Real mode** for working actual deals (no game layer).

Built with **Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4 + Supabase**. Deployed on
Vercel at https://www.credeals.io.

## Architecture

- `src/lib/sim/` — pure, deterministic engines (no React, unit-tested):
  - `napkin.ts` — quick valuation (GPR → NOI → value-at-cap, DSCR).
  - `detailedUW.ts` — full multi-year proforma: line-item income/expenses, a debt stack (senior +
    supplemental + seller note + refi), preferred-equity carry, and an LP/GP promote waterfall with
    IRR/equity-multiple/cash-on-cash.
  - `gameEngine.ts` — offer/LOI negotiation, capital raise, and closing resolvers (input → outcome).
  - `scenarios.ts` / `encounters.ts` — the branching scenario (storylet) framework + PSA clause library.
  - `personas.ts`, `seed.ts`, `format.ts`, `types.ts`.
- `src/components/` — the workspace UI (buy box, deal feed, lifecycle phase panels, encounter modals).
- `src/lib/store.tsx` — the React context: app state, game vs. real mode, Supabase-backed vs. local data.
- `src/app/` — App Router pages: `/` public landing, `/app` workspace, `/admin` (+ `/admin/scenarios`
  builder), `/api/*` route handlers, `/login` + `/auth/*`.
- `supabase/migrations/` — schema (run in the Supabase SQL editor, in order).

## Local development

```bash
npm install
cp .env.local.example .env.local   # then fill in the values below
npm run dev                         # http://localhost:3210
```

### Environment variables (`.env.local`)

The app uses **distinctly-named** Supabase vars (so it never collides with other local projects):

| Var | Purpose |
|-----|---------|
| `NEXT_PUBLIC_SB_URL` | Supabase project URL |
| `NEXT_PUBLIC_SB_ANON_KEY` | Supabase anon key (public, RLS-protected) |
| `SB_SERVICE_ROLE_KEY` | Service role key — **server-only**, used by admin route handlers |
| `CENSUS_API_KEY` | (optional) US Census ACS key for real income/population on the landing |

Without these the app still runs **open, in local mode** (localStorage, seeded demo deals, no login).
With them present it gates behind login and reads/writes Supabase under row-level security.

After creating the Supabase project, run the migrations in `supabase/migrations/` (SQL editor), set the
auth **Site URL** + redirect URLs, and `update profiles set is_admin = true` for your own user.

## Scripts

```bash
npm run dev          # dev server (port 3210)
npm run build        # production build + typecheck
npm run lint         # eslint
npm test             # vitest — unit tests for the financial + game engines
npm run test:watch   # vitest watch mode
```

## Tests

The financial and game engines are covered by `src/lib/sim/__tests__/` — the proforma identities
(NOI, equity, waterfall reconciliation), per-cell overrides, input clamping, IRR/PMT math, and the
negotiation/closing resolvers. Run `npm test`.
