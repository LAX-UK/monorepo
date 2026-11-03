#!/usr/bin/env bash
# Inject debug IDs into a built dist directory and upload its source maps.
# Injection is deterministic for identical build output, so a later re-run for
# the same release produces the same debug IDs as the shipped build.
#
# Usage: sentry-upload-sourcemaps.sh <dist-dir> <sentry-project>
# Env: RELEASE
set -euo pipefail

dist="$1"
project="$2"
retry="$(dirname "$0")/sentry-retry.sh"

sentry-cli sourcemaps inject "$dist"
"$retry" sentry-cli sourcemaps upload --release="$RELEASE" -p "$project" "$dist"
