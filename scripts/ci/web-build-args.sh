#!/usr/bin/env bash
# Validate and compose Docker build-args for the prebuilt apps/web image.
#
# Public values: infra/web-build/<env>.env (must mirror Terraform locals).
# GitHub vars/secrets: passed as environment variables by the caller (see
# infra/web-build/README.md).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

env_file_path() {
  echo "${REPO_ROOT}/infra/web-build/${ENVIRONMENT}.env"
}

tf_main_path() {
  echo "${REPO_ROOT}/infra/terraform/ephemeral/${ENVIRONMENT}/main.tf"
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

cmd_verify_origin() {
  require_environment
  local env_file tf_file env_origin tf_origin
  env_file="$(env_file_path)"
  tf_file="$(tf_main_path)"

  env_origin="$(grep -E '^NEXT_PUBLIC_WEB_ORIGIN=' "$env_file" | head -n1 | cut -d= -f2-)"
  tf_origin="$(grep -E '^[[:space:]]*web_origin[[:space:]]*=' "$tf_file" | head -n1 | sed -E 's/.*"([^"]*)".*/\1/')"

  if [[ -z "$env_origin" || -z "$tf_origin" ]]; then
    echo "::error::Could not read web origin from $env_file ('$env_origin') or $tf_file ('$tf_origin')" >&2
    exit 1
  fi
  if [[ "$env_origin" != "$tf_origin" ]]; then
    echo "::error::NEXT_PUBLIC_WEB_ORIGIN mismatch: $env_file='$env_origin' vs $tf_file web_origin='$tf_origin'" >&2
    exit 1
  fi
  echo "web origin OK: $env_origin"
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
  emit "NEXT_PUBLIC_DISABLE_CONSENT_BANNER" "${NEXT_PUBLIC_DISABLE_CONSENT_BANNER:-}"
  emit "NEXT_PUBLIC_CSP_REPORT_URI" "${NEXT_PUBLIC_CSP_REPORT_URI:-}"
  emit "CSP_ENFORCE" "${CSP_ENFORCE:-}"
  emit "NEXT_PUBLIC_TURNSTILE_SITE_KEY" "${NEXT_PUBLIC_TURNSTILE_SITE_KEY:-}"
  emit "NEXT_PUBLIC_SENTRY_DSN_WEB" "${NEXT_PUBLIC_SENTRY_DSN_WEB:-}"
  emit "SENTRY_RELEASE" "${SENTRY_RELEASE:-}"
  emit "SENTRY_PROJECT" "lax-${ENVIRONMENT}-web"
}

usage() {
  echo "usage: ENVIRONMENT=<test|prod> $0 {verify-origin|compose-args}" >&2
}

case "${1:-}" in
  verify-origin) cmd_verify_origin ;;
  compose-args) cmd_compose_args ;;
  *) usage; exit 1 ;;
esac
