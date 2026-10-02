#!/usr/bin/env bash
# Run full Phase 1 Shop staging acceptance twice on the same deployed SHA.
# Usage: ./scripts/ci/dispatch-shop-phase1-acceptance-twice.sh <40-char-shop-sha>
set -euo pipefail

shop_sha="${1:?Usage: $0 <deployed-shop-sha-from-health-ready>}"
if ! [[ "$shop_sha" =~ ^[0-9a-f]{40}$ ]]; then
  echo "shop_sha must be a 40-character git commit SHA" >&2
  exit 1
fi

for run in 1 2; do
  echo "Dispatching Shop staging acceptance run ${run}/2 (seed_catalogue=true) for ${shop_sha}..."
  gh workflow run "Shop staging acceptance" \
    -f "shop_sha=${shop_sha}" \
    -f "seed_catalogue=true"
  sleep 5
  run_id="$(gh run list --workflow="Shop staging acceptance" --limit 1 --json databaseId --jq '.[0].databaseId')"
  echo "Run ${run}: https://github.com/LAX-UK/monorepo/actions/runs/${run_id}"
  gh run watch "$run_id" --exit-status
done

echo "Both Phase 1 acceptance runs succeeded for ${shop_sha}."
