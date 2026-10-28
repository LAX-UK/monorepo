#!/usr/bin/env bash
# Dry run of the Bid staff roles clean-up against the TEST environment (lax-test-postgres):
# every staff member's roles now and after, and the permissions they gain or lose. Read-only:
# the session refuses writes. Credentials are resolved through doctl and never printed.
# Refuses any other cluster.
#
#   scripts/test-env/staff-roles-dry-run.sh [--out <file>]
#
# Options:
#   --out <file>   write the Markdown report to <file> instead of stdout
#
# Exits non-zero when someone would lose a permission or an organisation membership still uses a
# removed role. Requires doctl (authenticated), node, pnpm.
set -euo pipefail
trap 'echo "staff-roles-dry-run: failed at line $LINENO" >&2' ERR

readonly EXPECTED_CLUSTER="lax-test-postgres"
readonly DATABASE_NAME="auction"

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
out=""

die() {
  echo "staff-roles-dry-run: $*" >&2
  exit 1
}
log() { echo "staff-roles-dry-run: $*" >&2; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --out) out="${2:-}"; shift 2 ;;
    -h | --help) sed -n '2,13p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "unknown argument: $1" ;;
  esac
done

for bin in doctl node pnpm; do
  command -v "$bin" >/dev/null || die "$bin is required"
done

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

log "target cluster $cluster_name ($cluster_id), database $DATABASE_NAME (read-only)"

# Runs with only PATH/HOME inherited; secrets go through the environment, never argv.
report() {
  (
    cd "$repo_root"
    for name in $(compgen -e); do
      case "$name" in PATH | HOME) ;; *) unset "$name" 2>/dev/null || true ;; esac
    done
    export NODE_ENV=development \
      DATABASE_URL_OWNER="$owner_url" \
      DATABASE_CA_CERT="$ca_cert" \
      STAFF_ROLE_CLEANUP_ENVIRONMENT="TEST ($EXPECTED_CLUSTER)"
    exec pnpm --silent --filter @auction/db db:report-staff-role-cleanup
  )
}

status=0
if [[ -n "$out" ]]; then
  report >"$out" || status=$?
  log "report written to $out"
else
  report || status=$?
fi
[[ "$status" -ne 0 ]] && log "the migration would not run as is: see losses and organisation roles in the report"
exit "$status"
