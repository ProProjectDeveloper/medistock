# MediStock

Pharmacy inventory and expiry management: stock by medicine and batch, first-expiry-first-out dispensing, expiry alerts, suppliers, purchase orders and reports.

This repo is the web app (React) plus the shared data layer the upcoming Expo phone app will reuse.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

With no configuration the app runs on **seeded demo data** kept in your browser (40 medicines, ~95 batches across every expiry band, 6 suppliers, 90 days of history). Sign in with any demo account, password `demo1234`:

| Role | Email | Can |
|---|---|---|
| Admin | admin@medistock.demo | everything, including settings |
| Pharmacist | pharmacist@medistock.demo | receive, dispense, adjust, quarantine, dispose, returns, orders, reports |
| Assistant | assistant@medistock.demo | view stock, receive, dispense |

Settings → Demo data → *Reset demo data* restores the seed.

## Connect Supabase

1. Create a Supabase project.
2. In the SQL editor run `supabase/migrations/20261001000000_init.sql`, then `supabase/seed.sql` if you want the demo data (dates are relative to the day you run it).
   With the Supabase CLI: `supabase link` then `supabase db push`.
3. Copy `apps/web/.env.example` to `apps/web/.env.local` and fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Project settings → API).
4. Create users under Authentication. **The first user to sign up becomes admin**; later users start as assistant (change `profiles.role` to promote them).

Row-level security enforces the roles: everyone signed in can read; assistants may only record receipts and dispensing as themselves; catalogue, suppliers and orders need pharmacist; settings and locations need admin. Stock movements are insert-only, so the audit trail cannot be edited.

## Layout

```
apps/web            React + Vite + TypeScript + Tailwind (tokens as CSS variables)
packages/core       Shared domain: types, expiry bands, FEFO, alerts, reports, operations,
                    the MediStockRepository interface, a demo store and a Supabase adapter
packages/tokens     Design tokens (tokens.json → tokens.css); same names for mobile
supabase/           Schema, row-level security and generated seed
docs/design-spec.md The design system and app plan this build follows
```

Every write is a pure function in `packages/core/src/operations.ts` that turns the current data into a change set. The demo store and Supabase both apply the same change set, so web and mobile share one set of rules.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the web app |
| `npm run build` | Regenerate tokens.css and build the web app |
| `npm run typecheck` | Type-check core and web |
| `npm test` | Unit tests for bands, FEFO, receiving, disposal, alerts and the seed |
| `npm run tokens` | Rebuild `packages/tokens/tokens.css` from `tokens.json` |
| `npm run seed:sql` | Regenerate `supabase/seed.sql` from the demo seed |

A USB barcode scanner works anywhere there is a search field: it types the barcode and presses Enter, which jumps to (or picks) the medicine. Press `/` to focus the top search.
