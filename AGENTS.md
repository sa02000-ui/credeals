<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

Single Next.js 16 (App Router) + React 19 + TypeScript app. Standard commands live in `package.json` and `README.md`; reference those rather than memorizing flags.

- **Runs without Supabase.** No `.env.local` / Supabase vars are required for dev. With those vars absent the app runs in "local mode" (localStorage, seeded demo deals, no login gate), which is the easy path for testing. The login/admin flows and Supabase reads/writes only activate once `NEXT_PUBLIC_SB_URL` / `NEXT_PUBLIC_SB_ANON_KEY` (and `SB_SERVICE_ROLE_KEY` for admin routes) are set.
- **Dev server port is 3000, not 3210.** `npm run dev` is plain `next dev`, so it serves on `http://localhost:3000` despite the README mentioning 3210. The core game lives at `/app`; landing is `/`.
- **`npm run lint` currently exits non-zero** due to pre-existing `react-hooks` errors in `src/lib/store.tsx` (e.g. set-state-in-effect). This is existing code, not an environment problem — don't try to "fix the environment" over it.
- **Core flow is fully client-side** in local mode: onboarding → "Call brokers" to source deals → open a deal → Napkin underwrite → "Pass Napkin → Detailed UW" advances the deal through the pipeline. "Keep underwriting" intentionally keeps the deal in the Napkin stage (it does not advance).
- `npm test` runs the vitest unit suite for the financial/game engines (`src/lib/sim/__tests__/`); `npm run build` includes the TypeScript typecheck.
