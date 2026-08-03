#!/usr/bin/env bash
# Deploy all Forge OS edge functions to the linked Supabase project.
# Run from the repo root: bash supabase/functions/deploy.sh
# Requires: supabase CLI logged in, project linked (supabase link --project-ref <ref>)
set -euo pipefail

FUNCTIONS=(
  "nightly-scoring"
  "fraud-detector"
  "shift-reminder"
  "mrm-reminder"
  "5s-challenge-generator"
  "send-push-notification"
)

for fn in "${FUNCTIONS[@]}"; do
  echo "Deploying $fn ..."
  supabase functions deploy "$fn" --no-verify-jwt
done

echo "All edge functions deployed."
