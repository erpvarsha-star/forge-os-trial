#!/usr/bin/env bash
# Deploy all Forge OS edge functions to the linked Supabase project.
# Run from the repo root: bash supabase/functions/deploy.sh
# Requires: supabase CLI logged in, project linked (supabase link --project-ref <ref>)
set -uo pipefail

# NOTE: function names must match Supabase's ^[A-Za-z][A-Za-z0-9_-]*$ — a name
# starting with a digit is rejected by the API, not by the CLI's own parsing,
# so it fails at deploy time rather than being caught locally. That is what
# "five-s-challenge-generator" is working around; it was "5s-challenge-generator"
# and every Deploy Edge Functions run failed on it.
FUNCTIONS=(
  "nightly-scoring"
  "fraud-detector"
  "shift-reminder"
  "mrm-reminder"
  "five-s-challenge-generator"
  "send-push-notification"
)

# Deliberately NOT `set -e` around the loop: with it, the first bad function
# aborted the script and every function after it in the list silently never
# deployed. That is how send-push-notification stayed undeployed for a week
# while the only visible symptom was one red run. Attempt all of them, then
# fail at the end if any did not land.
failed=()
for fn in "${FUNCTIONS[@]}"; do
  echo "Deploying $fn ..."
  if ! supabase functions deploy "$fn" --no-verify-jwt; then
    echo "::error::Failed to deploy $fn"
    failed+=("$fn")
  fi
done

if [ ${#failed[@]} -gt 0 ]; then
  echo ""
  echo "❌ ${#failed[@]} of ${#FUNCTIONS[@]} function(s) failed to deploy: ${failed[*]}"
  exit 1
fi

echo "All ${#FUNCTIONS[@]} edge functions deployed."
