# Forge OS

Plant intelligence system for **Varsha Forgings Pvt Ltd** (VFPL) — 109 employees,
7 roles, 3 rotating shifts, 24-hour operation. Forge OS replaces paper registers,
WhatsApp coordination, and disconnected Google Forms with one bilingual mobile
app covering attendance, operations, HR, payroll, and performance.

Source of truth for product scope: *ForgeOS Master System Definition v1.0 (Aug 2026)*.

## Repo layout

```
forge-os/
├── app/                    # React Native / Expo screens (frontend, generated separately)
├── components/             # Shared UI components (frontend)
├── lib/                    # Shared TypeScript libs — Supabase client, config, payslip generator
├── i18n/                   # en.json / hi.json bilingual strings
├── hooks/                  # Shared React hooks (frontend)
├── types/                  # Shared TypeScript types
├── constants/              # Shared constants (frontend)
├── supabase/
│   └── functions/          # Supabase Edge Functions (Deno)
├── scripts/                # schema.sql, Apps Script migration, one-off tooling
├── .env.example
└── README.md
```

## Backend pieces in this repo

- **`scripts/schema.sql`** — complete Postgres schema (tables, enums, RLS, triggers,
  seed data) for the Supabase project. Run once in the Supabase SQL Editor.
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
  - `5s-challenge-generator` — generates a daily 5S housekeeping challenge per
    department/shift to drive floor engagement.
- **`lib/supabase.ts`** / **`lib/config.ts`** — typed Supabase client and central
  plant configuration (GPS/geofence, role colours, deduction rates, shift times).
- **`lib/payslip.ts`** — payslip PDF generator matching the VFL paper payslip
  format (Module 5).
- **`scripts/schema.sql`** and **`scripts/MigrateToSupabase.gs`** together
  implement the three-layer architecture from Section 4 of the Master System
  Definition: Google Sheets stays the source of truth for the Employee Master
  and the 107 department forms; Supabase is the operational database; Apps
  Script / n8n is the sync bridge.
- **`i18n/en.json`**, **`i18n/hi.json`** — bilingual strings for all 7 role
  screens (Owner, Plant Head, Manager, Supervisor, Member, HR Admin, Security
  Guard).

## Frontend

The React Native app (all screens, all 7 roles) is generated separately and
drops into `app/`, `components/`, `hooks/`, `types/`, `constants/` in this same
repo — it consumes `lib/supabase.ts`, `lib/config.ts`, `lib/payslip.ts`, and
`i18n/*.json` directly.

## Local setup

1. `cp .env.example .env` and fill in your Supabase project URL/keys.
2. Run `scripts/schema.sql` in the Supabase SQL Editor (free tier is sufficient
   for 109 users).
3. Deploy the edge functions: `supabase functions deploy <name>` for each
   folder under `supabase/functions/`.
4. Schedule `nightly-scoring` at 22:00 IST, `mrm-reminder` daily from the 8th,
   `shift-reminder` weekly (Thursday) + daily, via Supabase Cron or n8n.
5. Paste `scripts/MigrateToSupabase.gs` into the Employee Master Google Sheet's
   Apps Script editor and configure the trigger per the header comment.

## Cost rules (permanent — see Master System Definition Section 5)

- SQL / RLS / functions / triggers / seed data → Supabase SQL Editor → free.
- Edge functions → Supabase free tier → free.
- Employee seeding → always via SQL, never via an AI UI builder.
- Total running cost target: ~₹3,000–4,000/month for the whole plant.
