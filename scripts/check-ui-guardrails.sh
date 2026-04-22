#!/usr/bin/env bash
#
# UI guardrails: enforce that apps/web only consumes shadcn primitives via
# `@auction/ui` and never reaches for raw HTML controls, legacy icon wrappers,
# or Radix directly. Intended for CI (exit non-zero on any violation).
#
# See docs/plans: shadcn_full-sweep_migration plan, "Definition of done".
#
# Usage: ./scripts/check-ui-guardrails.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

fail=0

# 1) No raw `<button` tags in apps/web source (tests are allowed).
#    Matches `<button ` (opening tag with attrs) and `<button>` (no-attr variant).
raw_buttons=$(
  grep -RInE '<button[[:space:]>/]' apps/web/src \
    --include='*.ts' --include='*.tsx' \
    --exclude='*.test.tsx' --exclude='*.test.ts' \
    || true
)
if [[ -n "${raw_buttons}" ]]; then
  echo "error: raw <button> element found in apps/web/src. Use Button from '@auction/ui/components/button'." >&2
  echo "${raw_buttons}" >&2
  fail=1
fi

# 2) No `MaterialIcon` imports — file has been removed in favor of lucide-react.
material_icon=$(
  grep -RInE 'MaterialIcon|from ["'\''][^"'\'']*material-icon' apps/web/src \
    --include='*.ts' --include='*.tsx' \
    || true
)
if [[ -n "${material_icon}" ]]; then
  echo "error: MaterialIcon is removed. Import the specific component from 'lucide-react' instead." >&2
  echo "${material_icon}" >&2
  fail=1
fi

# 3) No direct @radix-ui/* imports — must go through @auction/ui.
#    (Biome also enforces this via noRestrictedImports, but CI greps act as a
#     belt-and-braces check on machines without Biome.)
radix_direct=$(
  grep -RInE 'from ["'\'']@radix-ui/' apps/web/src \
    --include='*.ts' --include='*.tsx' \
    || true
)
if [[ -n "${radix_direct}" ]]; then
  echo "error: direct @radix-ui/* import in apps/web/src. Use the re-export from '@auction/ui/components/<name>' instead." >&2
  echo "${radix_direct}" >&2
  fail=1
fi

if [[ "${fail}" -ne 0 ]]; then
  exit 1
fi
echo "ui guardrails: ok"
