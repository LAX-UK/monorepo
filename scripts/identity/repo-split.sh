#!/usr/bin/env bash
# Mechanical git subtree split for the extractable identity stack.
#
# Creates local branches (does not push) with history limited to each prefix:
#   split/identity/auth-app          <- apps/auth
#   split/identity/auth              <- packages/auth
#   split/identity/identity-contracts  <- packages/identity-contracts
#   split/identity/identity-db         <- packages/identity-db
#
# Usage:
#   ./scripts/identity/repo-split.sh
#   ./scripts/identity/repo-split.sh --dry-run
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
fi

declare -a SPLITS=(
  "apps/auth:split/identity/auth-app"
  "packages/auth:split/identity/auth"
  "packages/identity-contracts:split/identity/identity-contracts"
  "packages/identity-db:split/identity/identity-db"
)

for entry in "${SPLITS[@]}"; do
  prefix="${entry%%:*}"
  branch="${entry##*:}"
  if [[ ! -d "$prefix" ]]; then
    echo "repo-split: missing prefix directory $prefix" >&2
    exit 1
  fi
  if $DRY_RUN; then
    echo "would run: git subtree split --prefix=$prefix -b $branch"
    continue
  fi
  echo "repo-split: splitting $prefix -> $branch"
  git subtree split --prefix="$prefix" -b "$branch"
done

if $DRY_RUN; then
  echo "repo-split: dry run complete (no branches created)"
else
  echo "repo-split: created ${#SPLITS[@]} local branches (split/identity/*)"
  echo "Next: add a new remote and push each branch, e.g."
  echo "  git remote add identity-origin git@github.com:your-org/lax-identity.git"
  echo "  git push identity-origin split/identity/auth-app:main"
fi
