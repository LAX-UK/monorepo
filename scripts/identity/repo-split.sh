#!/usr/bin/env bash
# Compatibility entrypoint for path-preserving Identity extraction.
#
# Creates one fresh clone and filters its history to the approved closure. It
# does not create branches in the source repository and never pushes.
#
# Usage:
#   ./scripts/identity/repo-split.sh /path/to/identity-repository
#   ./scripts/identity/repo-split.sh --dry-run
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
exec node "$ROOT/scripts/identity/extract-identity.mjs" "$@"
