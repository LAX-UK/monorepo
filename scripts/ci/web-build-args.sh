#!/usr/bin/env bash
# Compose Docker build-args for the prebuilt apps/web image.
#
# Public values are checked out from the private infra repository at
# <INFRA_CONFIG_ROOT>/web-build/<env>.env. GitHub vars/secrets are passed as
# environment variables by the caller.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INFRA_CONFIG_ROOT="${INFRA_CONFIG_ROOT:-${REPO_ROOT}/.infra-config}"

env_file_path() {
  echo "${INFRA_CONFIG_ROOT}/web-build/${ENVIRONMENT}.env"
}

require_environment() {
  if [[ -z "${ENVIRONMENT:-}" ]]; then
    echo "::error::ENVIRONMENT is required (test|prod)" >&2
    exit 1
  fi
  if [[ "${ENVIRONMENT}" != "test" && "${ENVIRONMENT}" != "prod" ]]; then
    echo "::error::ENVIRONMENT must be test or prod, got '${ENVIRONMENT}'" >&2
    exit 1
  fi
}

emit() {
  printf '%s=%s\n' "$1" "${2:-}"
}

cmd_compose_args() {
  require_environment
  local env_file
  env_file="$(env_file_path)"

  if [[ ! -f "$env_file" ]]; then
    echo "::error::Missing web build args file $env_file" >&2
    exit 1
  fi

  grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$env_file"

  emit "NEXT_PUBLIC_GTM_ID" "${NEXT_PUBLIC_GTM_ID:-}"
  emit "NEXT_PUBLIC_MARKETING_ATTRIBUTION_ENABLED" "${NEXT_PUBLIC_MARKETING_ATTRIBUTION_ENABLED:-false}"
  emit "NEXT_PUBLIC_CSP_REPORT_URI" "${NEXT_PUBLIC_CSP_REPORT_URI:-}"
  emit "CSP_ENFORCE" "${CSP_ENFORCE:-}"
  emit "NEXT_PUBLIC_TURNSTILE_SITE_KEY" "${NEXT_PUBLIC_TURNSTILE_SITE_KEY:-}"
  emit "NEXT_PUBLIC_TURNSTILE_REQUIRED" "${NEXT_PUBLIC_TURNSTILE_REQUIRED:-}"
  emit "NEXT_PUBLIC_SENTRY_DSN_WEB" "${NEXT_PUBLIC_SENTRY_DSN_WEB:-}"
  emit "SENTRY_RELEASE" "${SENTRY_RELEASE:-}"
  emit "SENTRY_PROJECT" "lax-${ENVIRONMENT}-web"
  if [[ "${ENVIRONMENT}" == "prod" ]]; then
    emit "NODE_RUNTIME_HEAP_MB" "768"
  else
    emit "NODE_RUNTIME_HEAP_MB" "384"
  fi
}

usage() {
  echo "usage: ENVIRONMENT=<test|prod> $0 compose-args" >&2
}

case "${1:-}" in
  compose-args) cmd_compose_args ;;
  *) usage; exit 1 ;;
esac
