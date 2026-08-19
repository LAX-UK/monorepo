#!/usr/bin/env bash
# Stub: version and publish @auction/identity-contracts for cross-repo consumers.
#
# Intended flow once the package is public:
#   1. Bump packages/identity-contracts/package.json version (semver)
#   2. pnpm --filter @auction/identity-contracts build
#   3. pnpm --filter @auction/identity-contracts test
#   4. npm publish packages/identity-contracts --access public --provenance
#
# Usage:
#   ./scripts/identity/publish-identity-contracts.sh [--dry-run]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PACKAGE_DIR="$ROOT/packages/identity-contracts"
DRY_RUN=false

if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
fi

if [[ ! -f "$PACKAGE_DIR/package.json" ]]; then
  echo "publish-identity-contracts: missing $PACKAGE_DIR/package.json" >&2
  exit 1
fi

VERSION="$(node --input-type=module -e "import pkg from './packages/identity-contracts/package.json' with { type: 'json' }; console.log(pkg.version)")"
echo "publish-identity-contracts: stub for @auction/identity-contracts@${VERSION}"

if $DRY_RUN; then
  echo "would run: pnpm --filter @auction/identity-contracts build test"
  echo "would run: npm publish $PACKAGE_DIR --access public"
  exit 0
fi

echo "Not implemented: wire registry credentials and remove this stub before publishing." >&2
echo "See scripts/identity/publish-identity-contracts.sh for the intended release steps." >&2
exit 1
