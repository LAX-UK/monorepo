#!/usr/bin/env node
/**
 * Emit GitHub Actions matrix JSON for build-images workflow_call.
 */
const ALL = [
  { component: "api", dockerfile: "apps/api/Dockerfile" },
  { component: "auth", dockerfile: "apps/auth/Dockerfile" },
  { component: "shop-identity", dockerfile: "apps/shop-identity/Dockerfile" },
  { component: "shop", dockerfile: "apps/shop/Dockerfile" },
  { component: "shop-api", dockerfile: "apps/shop-api/Dockerfile" },
  { component: "shop-admin", dockerfile: "apps/shop-admin/Dockerfile" },
  { component: "account", dockerfile: "apps/account/Dockerfile" },
  { component: "ws", dockerfile: "apps/ws/Dockerfile" },
  { component: "worker", dockerfile: "apps/worker/Dockerfile" },
  { component: "migrate", dockerfile: "docker/migrate.Dockerfile" },
  { component: "web", dockerfile: "apps/web/Dockerfile" },
  { component: "clamav", dockerfile: "apps/clamav/Dockerfile" },
];

function main() {
  const raw = process.env.COMPONENTS_JSON ?? "";
  let selected = ALL.map((r) => r.component);
  if (raw.trim()) {
    selected = JSON.parse(raw);
  }
  const include = ALL.filter((row) => selected.includes(row.component));
  if (include.length === 0) {
    throw new Error("No components selected for build-images matrix");
  }
  const json = JSON.stringify({ include });
  process.stdout.write(`${json}\n`);
}

main();
