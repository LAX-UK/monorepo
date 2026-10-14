#!/usr/bin/env bash
# Seeds the TEST environment (lax-test-postgres) with the lax.art demo dataset,
# resolving credentials on the fly through doctl. Refuses any other cluster.
#
#   scripts/test-env/seed-art-demo.sh --email <acceptance-account-email> [options]
#
# Steps (each idempotent; re-runs reuse rows and content-addressed media):
#   1. catalogue     foundation catalogue + Art channel originals
#   2. legacy        www.thelax.art import (artists, artworks incl. sold, stories, pages, images)
#   3. editorial     showcase venue, exhibitions (current/upcoming/past), stories, guide
#   4. account       acceptance portal + commerce + staff-operations fixtures for --email
#
# Options:
#   --email <email>        auth account that receives portal/commerce/staff fixtures
#   --skip <step>          skip a step (repeatable): catalogue|legacy|editorial|account
#   --export <file>        legacy export JSON (default .tmp/seo/legacy-thelax-export.json)
#   --temporary-full-access-key
#                          legacy media: mint an account-wide Spaces key, deleted on exit
#                          (DigitalOcean allows only those on buckets with a policy)
#   --yes                  do not prompt for confirmation
#
# Legacy media goes to the shared lax-media bucket using MEDIA_SPACES_ACCESS_KEY_ID /
# MEDIA_SPACES_SECRET_ACCESS_KEY from the environment, or --temporary-full-access-key.
# Requires doctl (authenticated), node, pnpm.
set -euo pipefail
trap 'echo "seed-art-demo: failed at line $LINENO" >&2' ERR

readonly EXPECTED_CLUSTER="lax-test-postgres"
readonly DATABASE_NAME="auction"
readonly MEDIA_BUCKET="lax-media"
readonly MEDIA_REGION="lon1"
readonly MEDIA_PUBLIC_BASE_URL="https://lax-media.lon1.cdn.digitaloceanspaces.com"
readonly ART_URL="https://test-art.lax.bid"

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
email=""
export_file=".tmp/seo/legacy-thelax-export.json"
assume_yes=false
temporary_full_access_key=false
skip=" "

die() {
  echo "seed-art-demo: $*" >&2
  exit 1
}
log() { echo "seed-art-demo: $*"; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --email) email="${2:-}"; shift 2 ;;
    --skip) skip+="${2:-} "; shift 2 ;;
    --export) export_file="${2:-}"; shift 2 ;;
    --yes) assume_yes=true; shift ;;
    --temporary-full-access-key) temporary_full_access_key=true; shift ;;
    -h | --help) sed -n '2,25p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "unknown argument: $1" ;;
  esac
done

runs() { [[ "$skip" != *" $1 "* ]]; }

for bin in doctl node pnpm; do
  command -v "$bin" >/dev/null || die "$bin is required"
done
if runs account && [[ -z "$email" ]]; then
  die "--email is required for the account step (or pass --skip account)"
fi
if runs legacy && [[ ! -f "$repo_root/$export_file" ]]; then
  die "legacy export not found at $export_file (run scripts/seo/crawl-legacy-thelax.mjs or --skip legacy)"
fi
if runs legacy && [[ "$temporary_full_access_key" != true ]] &&
  [[ -z "${MEDIA_SPACES_ACCESS_KEY_ID:-}" || -z "${MEDIA_SPACES_SECRET_ACCESS_KEY:-}" ]]; then
  die "legacy media needs MEDIA_SPACES_ACCESS_KEY_ID/MEDIA_SPACES_SECRET_ACCESS_KEY, --temporary-full-access-key, or --skip legacy"
fi

json_field() {
  node -e '
    const value = JSON.parse(require("fs").readFileSync(0, "utf8"));
    const row = Array.isArray(value) ? value[0] : value;
    const out = process.argv.slice(1).map((key) => row?.[key]).find((v) => v != null && v !== "");
    if (out == null) process.exit(1);
    process.stdout.write(String(out));
  ' "$@"
}

cluster_id="$(
  doctl databases list -o json | node -e '
    const rows = JSON.parse(require("fs").readFileSync(0, "utf8"))
      .filter((row) => row.name === process.argv[1]);
    if (rows.length !== 1) process.exit(1);
    process.stdout.write(rows[0].id);
  ' "$EXPECTED_CLUSTER"
)" || die "expected exactly one cluster named $EXPECTED_CLUSTER"

cluster_name="$(doctl databases get "$cluster_id" -o json | json_field name)"
[[ "$cluster_name" == "$EXPECTED_CLUSTER" ]] || die "cluster $cluster_id is $cluster_name, refusing"

connection="$(doctl databases connection "$cluster_id" -o json)"
db_host="$(json_field host <<<"$connection")"
db_port="$(json_field port <<<"$connection")"
[[ "$db_host" == "$EXPECTED_CLUSTER-"* ]] || die "host $db_host is not $EXPECTED_CLUSTER, refusing"

# shop_app's password is Terraform-managed (not stored by DigitalOcean), so seeds run as the owner.
owner_url="$(
  doctl databases user get "$cluster_id" doadmin -o json |
    DB_HOST="$db_host" DB_PORT="$db_port" DB_NAME="$DATABASE_NAME" node -e '
      const [user] = JSON.parse(require("fs").readFileSync(0, "utf8"));
      if (!user?.password) process.exit(1);
      const { DB_HOST, DB_PORT, DB_NAME } = process.env;
      const password = encodeURIComponent(user.password);
      process.stdout.write(
        "postgresql://doadmin:" + password + "@" + DB_HOST + ":" + DB_PORT + "/" + DB_NAME + "?sslmode=require",
      );
    '
)" || die "could not resolve doadmin credentials"
ca_cert="$(doctl databases get-ca "$cluster_id" -o json | json_field certificate | base64 --decode)"

log "target cluster $cluster_name ($cluster_id), database $DATABASE_NAME"
log "steps:$(for step in catalogue legacy editorial account; do runs "$step" && printf ' %s' "$step"; done)"
if [[ "$assume_yes" != true ]]; then
  read -r -p "Seed TEST ($ART_URL)? Catalogue seed may mark reed-study editions sold. [y/N] " answer
  [[ "$answer" == "y" || "$answer" == "Y" ]] || die "aborted"
fi

work_dir="$(mktemp -d)"
chmod 700 "$work_dir"
spaces_key_id=""
cleanup() {
  if [[ -n "$spaces_key_id" ]]; then
    doctl spaces keys delete "$spaces_key_id" </dev/null >/dev/null 2>&1 ||
      echo "seed-art-demo: WARNING delete Spaces key $spaces_key_id manually (doctl spaces keys delete)" >&2
  fi
  rm -rf "$work_dir"
}
trap cleanup EXIT

base_env=(
  "NODE_ENV=development"
  "DATABASE_URL_SHOP=$owner_url"
  "DATABASE_URL_OWNER=$owner_url"
  "DATABASE_CA_CERT=$ca_cert"
)

# isolated [NAME=value ...] -- <command ...>
# Runs with only PATH/HOME inherited; secrets go through `export`, never argv.
isolated() {
  local assignments=()
  while [[ $# -gt 0 && "$1" != "--" ]]; do
    assignments+=("$1")
    shift
  done
  shift
  (
    cd "$repo_root"
    for name in $(compgen -e); do
      case "$name" in PATH | HOME) ;; *) unset "$name" 2>/dev/null || true ;; esac
    done
    export "${base_env[@]}" ${assignments[@]+"${assignments[@]}"}
    exec "$@"
  )
}

# shop_api <script> [NAME=value ...] [-- script args ...]
shop_api() {
  local script="$1"
  shift
  local extra_env=()
  while [[ $# -gt 0 && "$1" != "--" ]]; do
    extra_env+=("$1")
    shift
  done
  [[ $# -gt 0 ]] && shift
  isolated ${extra_env[@]+"${extra_env[@]}"} -- \
    pnpm --silent --filter @auction/shop-api "$script" ${1+-- "$@"}
}

log "building shop-api and workspace dependencies"
(cd "$repo_root" && pnpm --silent --filter "@auction/shop-api..." build >/dev/null)

if runs catalogue; then
  log "[catalogue] foundation catalogue + Art originals"
  shop_api seed:catalogue
fi

if runs legacy; then
  media_key_id="${MEDIA_SPACES_ACCESS_KEY_ID:-}"
  media_secret="${MEDIA_SPACES_SECRET_ACCESS_KEY:-}"
  if [[ -z "$media_key_id" || -z "$media_secret" ]]; then
    # lax-media has a bucket policy, which DigitalOcean only allows for account-wide keys.
    log "[legacy] creating temporary account-wide Spaces key (deleted on exit)"
    key_json="$(
      doctl spaces keys create "seed-art-demo-$(date +%Y%m%d%H%M%S)" \
        --grants "bucket=;permission=fullaccess" -o json 2>&1
    )" || die "[legacy] could not create Spaces key: $(node -e 'try{const j=JSON.parse(process.argv[1]);console.log(JSON.stringify(j.errors??j))}catch{console.log("unparseable doctl output")}' "$key_json")"
    spaces_key_id="$(json_field access_key <<<"$key_json")" || die "[legacy] unexpected doctl key response"
    media_key_id="$spaces_key_id"
    media_secret="$(json_field secret_key <<<"$key_json")"
    unset key_json
  fi
  log "[legacy] importing $export_file"
  shop_api import:legacy-thelax \
    "S3_BUCKET=$MEDIA_BUCKET" \
    "S3_REGION=$MEDIA_REGION" \
    "S3_ENDPOINT=https://$MEDIA_REGION.digitaloceanspaces.com" \
    "S3_ACCESS_KEY_ID=$media_key_id" \
    "S3_SECRET_ACCESS_KEY=$media_secret" \
    "SHOP_MEDIA_PUBLIC_BASE_URL=$MEDIA_PUBLIC_BASE_URL" \
    -- --export "$export_file" \
    --redirects-out "$work_dir/legacy-redirects.json" \
    --report-out "$work_dir/legacy-report.json" | tail -n 40
  unset media_secret
fi

if runs editorial; then
  log "[editorial] showcase venue, exhibitions, stories, guide"
  shop_api seed:editorial-showcase "SHOP_EDITORIAL_ENABLED=true"
fi

if runs account; then
  log "[account] resolving auth subject for $email"
  subject="$(isolated -- node scripts/ci/resolve-shop-acceptance-portal-subject.mjs --email "$email")"
  [[ -n "$subject" ]] || die "no auth user for $email"
  shop_api seed:acceptance-portal "SHOP_ACCEPTANCE_PORTAL_SUBJECT_ID=$subject"
  shop_api seed:acceptance-commerce "SHOP_ACCEPTANCE_PORTAL_SUBJECT_ID=$subject"
  shop_api seed:acceptance-staff-operations "SHOP_ACCEPTANCE_PORTAL_SUBJECT_ID=$subject" >/dev/null
  log "[account] fixtures attached to $email"
fi

log "verifying $ART_URL"
for path in / /artworks /artists /exhibitions /collector-hub /visit; do
  status="$(curl -s -o /dev/null -w '%{http_code}' "$ART_URL$path")"
  printf '  %-15s %s\n' "$path" "$status"
done
log "done. Editorial pages stay 'coming soon' until SHOP_EDITORIAL_ENABLED and ART_EDITORIAL_ENABLED are true on test."
