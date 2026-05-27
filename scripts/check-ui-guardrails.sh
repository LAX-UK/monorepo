#!/usr/bin/env bash
#
# UI guardrails: enforce that apps/web only consumes shadcn primitives via
# `@auction/ui` and never reaches for raw HTML controls, legacy icon wrappers,
# or Radix directly. Intended for CI (exit non-zero on any violation).
#
# Native form controls are additionally checked in apps/web lint via
# apps/web/scripts/check-native-form-controls.mjs.
#
# Usage: ./scripts/check-ui-guardrails.sh
set -euo pipefail
exec node "$(dirname "$0")/check-ui-guardrails.mjs"
