# OSKA DUE

Your Payments. Your People. One Dashboard.

## Run locally

Requires Node.js 20.9 or later. In this directory:

```powershell
npm ci
npm run dev
```

Open http://127.0.0.1:3000. For a production build use `npm run build` and `npm start`.

## Validation

`npm test` runs the 18 numbered financial acceptance cases plus canonical SQL/JSON seed export. `npm run typecheck` checks TypeScript. `npm run build` checks production compilation.

## Data and settlement design

All amounts use integer LKR cents. 9 purchase plans, 35 installments and 39 independent allocations are seeded once on a new browser. The four shared installments each have two allocations. Initial outstanding is LKR 82,679.97, computed from allocations.
Person settlements are an append-only ledger. Edits reverse the original and append a replacement atomically. Koko payment flags belong to installments and do not change person balances. Full payment request keys prevent rapid double clicks. Local writes use Web Locks where available, re-read storage before each write, validate state, and publish storage events to other tabs. Unsupported Web Locks browsers should use one tab for writes. No value is updated in the UI until persistence succeeds. Corrupt storage is preserved for recovery rather than silently reseeded.

## Pages

`/` overview; `/people/thiranji`, `/people/oshadha`, `/people/ayesh`, `/people/supun`; `/planner`; `/purchases`; `/history`; `/import`; `/settings`.
Purchases can be added or edited with manual person splits. Purchases with settlement history are protected. Screenshot import supports local preview, SHA-256 duplicate detection and manual entry; OCR is not implemented. JSON restore explicitly asks before replacing local data. CSV exports allocation balances in integer cents.

## Supabase deployment preparation

`supabase/migrations/001_schema.sql` provides normalized PostgreSQL tables, per-owner RLS, ledger invariants, row locking and immutable transaction history. `supabase/seed.sql` is generated from the same application seed. Execute the schema in a test Supabase project, then run seed SQL in an authenticated user context (auth.uid must be set). Never expose service-role keys. Supabase runtime integration and authentication are not enabled in the local app. The Settings selector accurately marks it unavailable. These SQL files have not been executed against an actual database.

## PWA and privacy

Responsive standalone manifest, SVG icon and service worker registration are included. The worker does not cache finance data or application routes; this build requires network access to the local server and does not claim offline operation. Local mode has no authentication and is intended for a trusted device. Clearing browser storage deletes local records: export JSON backups regularly. No deployment has been performed.

Next.js installation reference: https://nextjs.org/docs/app/getting-started/installation
