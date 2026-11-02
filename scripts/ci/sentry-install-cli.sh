#!/usr/bin/env bash
# Install the Sentry CLI at the version pinned in the root package.json, so the
# workflows and the image builds share one version. Retries with back-off.
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
version="$(node -p "require('${root}/package.json').devDependencies['@sentry/cli']")"
"$(dirname "$0")/sentry-retry.sh" npm i -g "@sentry/cli@${version}"
