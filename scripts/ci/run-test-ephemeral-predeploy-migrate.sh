#!/usr/bin/env bash
# Apply full test journal migrations and shop_app grants before App Platform rolls
# out shop-api (avoids health-check race with the parallel migrate job).
set -euo pipefail

tf_dir="${1:?terraform working directory}"
migrate_image="${2:?migrate image reference}"

tf_output() {
  terraform -chdir="$tf_dir" output -raw "$1"
}

valid_postgres_url() {
  node -e 'new URL(process.argv[1]); process.exit(0)' "$1" 2>/dev/null
}

declare -A outputs=(
  [DATABASE_URL_OWNER]=postgres_owner_uri
  [DATABASE_URL_AUTH]=database_url_auth
  [DATABASE_URL_API]=database_url_api
  [DATABASE_URL_WORKER]=database_url_worker
  [OIDC_CLIENT_SECRET_LAX_BID_WEB]=oidc_bid_web_client_secret
  [OIDC_CLIENT_SECRET_LAX_SHOP_WEB]=oidc_shop_web_client_secret
)

for env_name in "${!outputs[@]}"; do
  value="$(tf_output "${outputs[$env_name]}")"
  if [[ -z "$value" && "$env_name" == "OIDC_CLIENT_SECRET_LAX_SHOP_WEB" ]]; then
    value="${OIDC_CLIENT_SECRET_LAX_SHOP_WEB_FALLBACK:-}"
  fi
  if [[ -z "$value" ]]; then
    echo "::error::Missing Terraform output ${outputs[$env_name]} for $env_name"
    exit 1
  fi
  export "$env_name=$value"
done

export DATABASE_URL="$DATABASE_URL_OWNER"

shop_url="$(tf_output database_url_shop)"
if ! valid_postgres_url "$shop_url"; then
  echo "::error::Missing or invalid Terraform output database_url_shop"
  exit 1
fi
export DATABASE_URL_SHOP="$shop_url"

while read -r password_name url_name; do
  url="${!url_name}"
  password="$(
    node -e \
      'process.stdout.write(decodeURIComponent(new URL(process.argv[1]).password))' \
      "$url"
  )"
  test -n "$password"
  export "$password_name=$password"
done <<'ROLES'
AUTH_APP_DB_PASSWORD DATABASE_URL_AUTH
API_APP_DB_PASSWORD DATABASE_URL_API
SHOP_APP_DB_PASSWORD DATABASE_URL_SHOP
WORKER_APP_DB_PASSWORD DATABASE_URL_WORKER
ROLES

database_ca_cert="$(tf_output database_ca_certificate)"
test -n "$database_ca_cert"

docker pull "$migrate_image"
docker run --rm \
  -e DATABASE_URL \
  -e DATABASE_URL_OWNER \
  -e "DATABASE_CA_CERT=$database_ca_cert" \
  -e AUTH_APP_DB_PASSWORD \
  -e API_APP_DB_PASSWORD \
  -e SHOP_APP_DB_PASSWORD \
  -e WORKER_APP_DB_PASSWORD \
  -e OIDC_CLIENT_SECRET_LAX_BID_WEB \
  -e OIDC_CLIENT_SECRET_LAX_SHOP_WEB \
  -e NODE_ENV=production \
  -e APP_ENV=test \
  "$migrate_image" \
  sh -ceu '
    node packages/db/dist/migrate.js
    node packages/db/dist/migrate-roles.js
    node packages/db/dist/scripts/configure-oidc-clients.js
  '

echo "test ephemeral pre-deploy migrate: ok"
