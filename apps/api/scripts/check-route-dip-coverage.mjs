/**
 * Ensures every production route module under src/routes is listed in at least one DIP script.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const scriptsDir = join(root, "scripts");
const routesDir = join(root, "src/routes");

function listRouteFiles(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      listRouteFiles(full, acc);
      continue;
    }
    if (name.endsWith(".ts") && !name.endsWith(".test.ts")) {
      acc.push(relative(root, full).replaceAll("\\", "/"));
    }
  }
  return acc;
}

function filesFromDipScript(scriptPath) {
  const text = readFileSync(scriptPath, "utf8");
  const files = [];
  const re = /["'](src\/routes\/[^"']+)["']/g;
  for (;;) {
    const m = re.exec(text);
    if (m === null) break;
    files.push(m[1]);
  }
  return files;
}

const dipScripts = readdirSync(scriptsDir)
  .filter((name) => name.startsWith("check-") && name.endsWith("-routes-dip.mjs"))
  .map((name) => join(scriptsDir, name));

const covered = new Set();
for (const script of dipScripts) {
  for (const file of filesFromDipScript(script)) {
    covered.add(file);
  }
}

const adminDir = join(routesDir, "admin");
if (statSync(adminDir).isDirectory()) {
  for (const name of readdirSync(adminDir)) {
    if (name.endsWith(".routes.ts")) {
      covered.add(`src/routes/admin/${name}`);
    }
  }
}

for (const name of readdirSync(scriptsDir)) {
  if (name !== "check-admin-routes-dip.mjs") continue;
  const text = readFileSync(join(scriptsDir, name), "utf8");
  const staticRe = /["'](src\/routes\/[^"']+)["']/g;
  for (;;) {
    const m = staticRe.exec(text);
    if (m === null) break;
    covered.add(m[1]);
  }
}

const routeFiles = listRouteFiles(routesDir).filter((rel) => {
  if (rel.endsWith("/_shared.ts")) return false;
  if (rel.endsWith("/_schemas.ts")) return false;
  if (rel === "src/routes/admin.ts") return false;
  return true;
});

/** Parent routers and infra-only boundaries documented in composition READMEs. */
const EXPLICIT_ALLOWLIST = new Set([
  "src/routes/health.ts",
  "src/routes/metrics.ts",
  "src/routes/openapi.ts",
  "src/routes/press.ts",
  "src/routes/categories.ts",
  "src/routes/lots.ts",
  "src/routes/sales.ts",
  "src/routes/submissions.ts",
  "src/routes/users.ts",
  "src/routes/bids.ts",
  "src/routes/legal-entities.ts",
  "src/routes/legal-entity-members.ts",
  "src/routes/organization-onboarding.ts",
  "src/routes/organizations.ts",
  "src/routes/xero-admin.ts",
  "src/routes/auth.ts",
  "src/routes/internal-cron.ts",
  "src/routes/internal-identity-email.routes.ts",
  "src/routes/internal-identity-subject-usage.routes.ts",
  "src/routes/payments.ts",
  "src/routes/payouts.ts",
  "src/routes/payout-statements.ts",
  "src/routes/stripe-connect.ts",
  "src/routes/xero-webhook.ts",
  "src/routes/webhooks/stripe.ts",
  "src/routes/webhooks/veriff.ts",
  "src/routes/webhooks/brevo.ts",
  "src/routes/webhooks/postmark.ts",
  "src/routes/admin.ts",
  "src/routes/admin/_schemas.ts",
  "src/routes/telephone-bookings/index.ts",
  "src/routes/admin-stripe-connect.routes.ts",
  "src/routes/email.ts",
  "src/routes/marketing.ts",
  "src/routes/newsletter.ts",
  "src/routes/onsite-events.ts",
  "src/routes/qr.ts",
  "src/routes/webhooks/index.ts",
  "src/routes/webhooks/stripe-payment-event-registry.ts",
]);

const uncovered = routeFiles.filter((rel) => !covered.has(rel) && !EXPLICIT_ALLOWLIST.has(rel));

if (uncovered.length > 0) {
  console.error("[check-route-dip-coverage] route files not referenced by any DIP script:");
  for (const rel of uncovered.sort()) {
    console.error(`  - ${rel}`);
  }
  process.exit(1);
}

console.log("check-route-dip-coverage: ok");
