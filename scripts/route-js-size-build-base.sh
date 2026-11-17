#!/usr/bin/env bash
# Builds a commit's apps with the size-build settings in THIS checkout, writes its route JavaScript
# report, and puts the checkout back on the commit it started from. It is the base route of the
# "Route JS: base vs head" table (docs/engineering/route-js-budgets.md, "Base vs head").
#
# Why in this checkout: Next 15 derives each server action id from the module's absolute path, and
# the Sentry debug ids and chunk hashes follow from the chunk content. A base built at any other
# path (a git worktree, say) differs from the head by tens of bytes per route although the code is
# the same. Building both at one path keeps the table free of noise, and a remote-cache replay of
# an app (built by CI in this same workspace path) is then byte-identical to a fresh build.
#
# The caller must run a copy of this script and of the measuring scripts kept outside the checkout
# (TOOLS_DIR), because the checkout changes underneath it.
#
# Usage: route-js-size-build-base.sh --sha <commit> --apps "<apps/a apps/b>" --filters "<--filter=..>"
#                                    --out <report.json> --tools <dir> [--force]
#   --force  ignore every turbo cache (the self-check uses it so the second build of the head is a
#            real build, not a replay of the first)
set -euo pipefail

sha="" apps="" filters="" out="" tools="" force=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --sha) sha=$2; shift 2 ;;
    --apps) apps=$2; shift 2 ;;
    --filters) filters=$2; shift 2 ;;
    --out) out=$2; shift 2 ;;
    --tools) tools=$2; shift 2 ;;
    --force) force=1; shift ;;
    *) echo "unknown option $1" >&2; exit 2 ;;
  esac
done
if [[ -z $sha || -z $apps || -z $filters || -z $out || -z $tools ]]; then
  echo "--sha, --apps, --filters, --out and --tools are required" >&2
  exit 2
fi

root=$(git rev-parse --show-toplevel)
cd "$root"
start_sha=$(git rev-parse HEAD)

# Removes everything git does not track (node_modules, .next, build output) except the local turbo
# cache, so each side gets a clean install and a clean build.
clean_checkout() {
  git clean -ffdxq -e .turbo/cache
}

restore_start() {
  local status=$?
  echo "Route JS: returning the checkout to $start_sha"
  git checkout -q --force --detach "$start_sha"
  clean_checkout
  pnpm install --frozen-lockfile --prefer-offline
  exit "$status"
}
trap restore_start EXIT

git checkout -q --force --detach "$sha"
clean_checkout
pnpm install --frozen-lockfile --prefer-offline

flags=()
if [[ $force == 1 ]]; then flags+=(--force); fi
size_build_module=packages/observability/src/next-size-build.ts
if [[ $sha != "$start_sha" ]] && { ! grep -q '"ROUTE_JS_SIZE_BUILD"' turbo.json || [[ ! -f $size_build_module ]]; }; then
  # A base from before deterministic size builds (only the runs of the PR that added them) has
  # none of the pins: its turbo.json does not let them through, its next.config.ts files cannot pin
  # the Sentry release, and it has no DeterministicSizeBuildPlugin. Give that checkout, for this
  # build only, the pins in its turbo.json build env, the start commit's next.config.ts files
  # (whose only size-build changes are the release pin and the plugin) and the plugin's module with
  # its package export, and build without cache in turbo's strict env mode. (Building it with
  # --env-mode=loose and the release pinned through SENTRY_RELEASE left Bid routes a few bytes
  # apart from the head.) The checkout goes back to the start commit afterwards, which undoes
  # these edits.
  echo "::notice title=Route JS base::The base predates deterministic size builds; building it without cache, with the pins applied for this build"
  node -e '
    const fs = require("node:fs");
    const config = JSON.parse(fs.readFileSync("turbo.json", "utf8"));
    const env = new Set(config.tasks.build.env ?? []);
    for (const name of ["NEXT_SERVER_ACTIONS_ENCRYPTION_KEY", "ROUTE_JS_SIZE_BUILD"]) env.add(name);
    config.tasks.build.env = [...env];
    fs.writeFileSync("turbo.json", `${JSON.stringify(config, null, 2)}\n`);
  '
  for app in $apps; do
    for config in "$app"/next.config.*; do
      if git cat-file -e "$start_sha:$config" 2>/dev/null; then git checkout -q "$start_sha" -- "$config"; fi
    done
  done
  git checkout -q "$start_sha" -- "$size_build_module"
  node -e '
    const fs = require("node:fs");
    const file = "packages/observability/package.json";
    const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
    pkg.exports["./next-size-build"] = {
      types: "./dist/next-size-build.d.ts",
      default: "./dist/next-size-build.js",
    };
    fs.writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`);
  '
  flags+=(--force)
fi

# The CI build job's cap on concurrent builds (BUILD_CONCURRENCY in ci.yml): every Next app build
# gets the job's large heap, and all of them at once overrun the runner's memory.
if [[ -n ${BUILD_CONCURRENCY:-} ]]; then flags+=(--concurrency="$BUILD_CONCURRENCY"); fi

# shellcheck disable=SC2086 # filters is a list of flags
pnpm turbo run build "${flags[@]}" $filters

app_args=()
for app in $apps; do app_args+=(--app "$app"); done
node "$tools/route-js-size-report.mjs" --root "$root" "${app_args[@]}" --label "${sha:0:10}" --out "$out"
