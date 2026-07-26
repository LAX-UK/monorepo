import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expectedAdminVisualSnapshotNames } from "../e2e/admin-visual-cases";

const MAX_ADMIN_BASELINES = 50;
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const snapshotDir = path.resolve(scriptDir, "../e2e/__snapshots__/admin-pages-visual.spec.ts");

const expected = new Set(expectedAdminVisualSnapshotNames);
const actual = new Set(readdirSync(snapshotDir).filter((file) => file.endsWith(".png")));
const duplicates = expectedAdminVisualSnapshotNames.filter(
  (name, index, names) => names.indexOf(name) !== index,
);
const missing = [...expected].filter((name) => !actual.has(name));
const orphaned = [...actual].filter((name) => !expected.has(name));

const errors: string[] = [];
if (expected.size > MAX_ADMIN_BASELINES) {
  errors.push(`admin visual budget exceeded: ${expected.size}/${MAX_ADMIN_BASELINES}`);
}
if (duplicates.length > 0) errors.push(`duplicate snapshots: ${duplicates.join(", ")}`);
if (missing.length > 0) errors.push(`missing snapshots: ${missing.join(", ")}`);
if (orphaned.length > 0) errors.push(`orphan snapshots: ${orphaned.join(", ")}`);

if (errors.length > 0) {
  console.error(`E2E portfolio check failed:\n- ${errors.join("\n- ")}`);
  process.exit(1);
}

console.log(`check-e2e-portfolio: ok (${actual.size}/${MAX_ADMIN_BASELINES} admin baselines)`);
