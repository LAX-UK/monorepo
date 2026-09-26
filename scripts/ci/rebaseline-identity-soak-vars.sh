#!/usr/bin/env bash
# Operator helper after staging recovery: set repo vars and dispatch the first soak sample.
# Usage: IDENTITY_SHA=<40-char> ./scripts/ci/rebaseline-identity-soak-vars.sh
set -euo pipefail
IDENTITY_SHA="${IDENTITY_SHA:?Set IDENTITY_SHA to the accepted test Identity commit}"
SOAK_STARTED_AT="${SOAK_STARTED_AT:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"
REPO="${GITHUB_REPOSITORY:-LAX-UK/monorepo}"
gh variable set IDENTITY_SOAK_SHA_TEST --body "$IDENTITY_SHA" --repo "$REPO"
gh variable set IDENTITY_SOAK_STARTED_AT_TEST --body "$SOAK_STARTED_AT" --repo "$REPO"
gh workflow run identity-staging-soak.yml --ref main --repo "$REPO" \
  -f mode=sample \
  -f "identity_sha=$IDENTITY_SHA" \
  -f "soak_started_at=$SOAK_STARTED_AT" \
  -f minimum_operations=1 \
  -f chain_next=true
echo "Soak re-baselined at $SOAK_STARTED_AT for $IDENTITY_SHA"
