# Reference snapshot: HR OS (Apps Script)

- Read-only snapshot of github.com/erpvarsha-star/hr-os at commit 857baa10a5cea330a0f03c0c1b246500a7c88ea4 (committed 2026-10-06T21:58:19Z).
- It is the Apps Script (Google Sheets) HR OS payroll system from which `lib/payroll/engine.ts` was ported and verified against Sept 2026 payouts.
- It is NOT part of the app build and is not deployed from here. Its `.github/workflows/deploy.yml`, `netlify.toml` and `package.json` are inert copies (workflows only run from the repo root).
- The source of truth stays in the hr-os repo. Do not edit these files; re-snapshot instead.
- Secret/PII scan before copying: no real secrets, tokens, keys, phone numbers, PAN, Aadhaar or bank details found. Test fixtures use obviously fake values (e.g. ABCDE1234F, FAKE0000001, Telegram docs example token).
- Contains by design: role mailboxes (hr@, accounts@, owner@, hrmanager@, ea.varshaforgings@gmail.com), the owner's gmail, a Google Sheet ID and Drive file IDs in DESIGN.md, a Netlify site ID in deploy.yml (not secrets), and employee codes (VFL1001, VFL4021, VFL4014, VFL4063) in config seeds.
- Withheld files: none.
