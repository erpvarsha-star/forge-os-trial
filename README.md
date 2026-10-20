# Forge OS

Plant intelligence system for **Varsha Forgings Pvt Ltd** (VFPL) — 109 employees,
7 roles, 3 rotating shifts, 24-hour operation. Forge OS replaces paper registers,
WhatsApp coordination, and disconnected Google Forms with one bilingual mobile
app covering attendance, operations, HR, payroll, and performance.

Source of truth for product scope: *ForgeOS Master System Definition v1.0 (Aug 2026)*.

## Repo layout

```
forge-os/
├── app/                    # React Native / Expo screens (all 7 roles)
├── components/             # Shared UI components
├── lib/                    # Shared TypeScript libs — Supabase client, config, payslip generator
├── i18n/                   # en.json / hi.json bilingual strings
├── hooks/                  # Shared React hooks
├── types/                  # Shared TypeScript types
├── constants/              # Shared constants
├── supabase/
│   ├── config.toml         # links this repo to the Supabase project (project_id only, no secrets)
│   ├── migrations/         # schema, in Supabase CLI/GitHub-integration migration format
│   └── functions/          # Supabase Edge Functions (Deno)
├── scripts/                # MigrateToSupabase.gs, one-off tooling
├── .env.example
└── README.md
```

## Supabase project

This repo is linked (via `supabase/config.toml`) to project ref
`odfwtdpvpfzdrznvurru`. If the Supabase GitHub integration is connected to
this repo, pushes to the default branch should auto-apply anything new in
`supabase/migrations/`. If it isn't connected yet (or you want to verify
before relying on it), run the migrations manually — see **Local setup**
below.

## Backend pieces in this repo

- **`supabase/migrations/*.sql`** — complete Postgres schema (tables, enums,
  RLS, triggers, seed data), split into two files:
  - `20260803090000_initial_schema.sql` — full schema derived from the
    Master System Definition doc, written before the real frontend existed.
  - `20260803090001_frontend_schema_patch.sql` — tables/columns the actual
    React Native app queries under different names (`attendance_records`,
    `casual_workers`, `fraud_alerts`, `vehicle_log`, `eod_confirmations`,
    key-value `plant_config`). **These two files still have some overlapping,
    differently-named tables that haven't been reconciled** — see the header
    comment in the second file for specifics before you rely on both.
- **`supabase/functions/*`** — six Edge Functions:
  - `nightly-scoring` — recalculates the monthly composite score for every active
    employee (Workflow 7), role-weighted, with brownie points and EoTM ranking.
  - `send-push-notification` — generic push dispatcher used by every other function
    and by the frontend for in-app notification delivery.
  - `fraud-detector` — bulk-confirmation and mock-location fraud checks
    (Workflow 11), escalates to HR Admin / Plant Head / Owner.
  - `shift-reminder` — Thursday shift-planning + daily shift-start reminders.
  - `mrm-reminder` — Monthly Review reminders/escalation from the 8th to the
    10th of each month (Workflow 8).
  - `five-s-challenge-generator` — generates a daily 5S housekeeping challenge per
    department/shift to drive floor engagement.
- **`lib/supabase.ts`** / **`lib/config.ts`** — typed Supabase client and central
  plant configuration (GPS/geofence, role colours, deduction rates, shift times).
- **`lib/payslip.ts`** — payslip PDF generator matching the VFL paper payslip
  format (Module 5).
- **`supabase/migrations/*.sql`** and **`scripts/MigrateToSupabase.gs`**
  together implement the three-layer architecture from Section 4 of the
  Master System Definition: Google Sheets stays the source of truth for the
  Employee Master and the 107 department forms; Supabase is the operational
  database; Apps Script / n8n is the sync bridge.
- **`i18n/en.json`**, **`i18n/hi.json`** — bilingual strings for all 7 role
  screens (Owner, Plant Head, Manager, Supervisor, Member, HR Admin, Security
  Guard).

## Local setup

1. `cp .env.example .env` and fill in your Supabase project URL/keys
   (`EXPO_PUBLIC_SUPABASE_URL=https://odfwtdpvpfzdrznvurru.supabase.co`, plus
   the anon/publishable and service role keys from Project Settings -> API —
   **never commit `.env` or paste real keys into a tracked file**).
2. Apply the schema — pick one:
   - **Supabase CLI**: `supabase link --project-ref odfwtdpvpfzdrznvurru` then
     `supabase db push` (applies everything in `supabase/migrations/` in order).
   - **SQL Editor** (no CLI needed): open the Supabase dashboard's SQL Editor
     and run `supabase/migrations/20260803090000_initial_schema.sql`, then
     `supabase/migrations/20260803090001_frontend_schema_patch.sql`, in that order.
   - **GitHub integration**: if connected to this repo, pushes to the default
     branch apply new migrations automatically — confirm in the Supabase
     dashboard under Project Settings -> Integrations.
3. Deploy the edge functions: `supabase functions deploy <name>` for each
   folder under `supabase/functions/`, and set `ANTHROPIC_API_KEY` as an edge
   function secret for `nightly-scoring`'s AI suggestions.
4. Schedule `nightly-scoring` at 22:00 IST, `mrm-reminder` daily from the 8th,
   `shift-reminder` weekly (Thursday) + daily, via Supabase Cron or n8n.
5. Paste `scripts/MigrateToSupabase.gs` into the Employee Master Google Sheet's
   Apps Script editor and configure the trigger per the header comment.

## Cost rules (permanent — see Master System Definition Section 5)

- SQL / RLS / functions / triggers / seed data → Supabase SQL Editor → free.
- Edge functions → Supabase free tier → free.
- Employee seeding → always via SQL, never via an AI UI builder.
- Total running cost target: ~₹3,000–4,000/month for the whole plant.
