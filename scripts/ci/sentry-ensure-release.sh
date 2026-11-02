#!/usr/bin/env bash
# Create (or confirm) the Sentry release for every existing project of an
# environment. Safe to re-run: an existing release is left as is, and `releases new`
# on an existing release is a no-op. Network calls go through sentry-retry.sh.
#
# Env: SENTRY_ORG, SENTRY_APPS (comma list), ENV_SUFFIX, RELEASE, GITHUB_REPOSITORY
set -euo pipefail

retry="$(dirname "$0")/sentry-retry.sh"

existing_projects="$("$retry" sentry-cli projects list -o "${SENTRY_ORG}" | grep -Eo 'lax-[a-z0-9-]+' | sort -u || true)"
IFS=',' read -ra apps <<< "${SENTRY_APPS}"
project_args=()
anchor_project=""
for app in "${apps[@]}"; do
  project="lax-${ENV_SUFFIX}-${app}"
  if echo "${existing_projects}" | grep -Fxq "${project}"; then
    project_args+=(-p "$project")
    if [ -z "${anchor_project}" ] && [ "${app}" = "api" ]; then
      anchor_project="${project}"
    fi
  else
    echo "::warning::Sentry project ${project} not found; skipping (apply terraform sentry layer to create it)"
  fi
done
if [ "${#project_args[@]}" -eq 0 ]; then
  echo "No Sentry projects found for environment ${ENV_SUFFIX}" >&2
  exit 1
fi
if [ -z "${anchor_project}" ]; then
  anchor_project="$(echo "${existing_projects}" | grep "^lax-${ENV_SUFFIX}-" | head -1)"
fi

if sentry-cli releases info "$RELEASE" -p "$anchor_project" >/dev/null 2>&1; then
  echo "Release ${RELEASE} already exists"
else
  echo "Creating release ${RELEASE} for all projects"
  "$retry" sentry-cli releases new "$RELEASE" "${project_args[@]}"
fi

# --auto requires GitHub repo integration and often 500s without it; explicit commit is safer.
if ! "$retry" sentry-cli releases set-commits "$RELEASE" \
  --commit "${GITHUB_REPOSITORY}@${RELEASE}" \
  --ignore-missing; then
  echo "::warning::set-commits failed; continuing without commit association"
fi
