#!/usr/bin/env bash
# Run a Sentry CLI command with retry and back-off.
#
# Usage: sentry-retry.sh <command> [args...]
#
# One initial attempt plus three retries, sleeping 10s, 30s and 60s between them.
# Exits non-zero only after every attempt has failed; the caller decides whether
# that is fatal. SENTRY_RETRY_DELAYS (space separated seconds) overrides the
# schedule, which the self-test below uses to stay fast.
set -uo pipefail

if [ "$#" -eq 0 ]; then
  echo "usage: sentry-retry.sh <command> [args...]" >&2
  exit 2
fi

read -ra delays <<< "${SENTRY_RETRY_DELAYS:-10 30 60}"
attempts=$((${#delays[@]} + 1))

for ((attempt = 1; attempt <= attempts; attempt++)); do
  if "$@"; then
    exit 0
  fi
  if [ "$attempt" -lt "$attempts" ]; then
    delay="${delays[$((attempt - 1))]}"
    echo "Attempt ${attempt}/${attempts} failed: $*. Retrying in ${delay}s." >&2
    sleep "$delay"
  fi
done

echo "All ${attempts} attempts failed: $*" >&2
exit 1
