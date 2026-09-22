import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("run-test-suite supports skipping web shards for split CI", () => {
  const source = readFileSync(join(root, "scripts/ci/run-test-suite.mjs"), "utf8");
  assert.match(source, /CI_SKIP_WEB_VITEST_SHARDS/);
});

test("run-test-suite isolates @auction/db when migration integration DB is configured", () => {
  const source = readFileSync(join(root, "scripts/ci/run-test-suite.mjs"), "utf8");
  assert.match(source, /MIGRATION_TEST_DATABASE_URL/);
  assert.match(source, /--filter=!@auction\/db/);
  assert.match(source, /--filter=@auction\/db/);
});

test("main full-verify runs web vitest on matrix runners", () => {
  const workflow = readFileSync(join(root, ".github/workflows/ci.yml"), "utf8");
  assert.match(workflow, /full-verify-web-vitest:/);
  assert.match(workflow, /CI_SKIP_WEB_VITEST_SHARDS: "1"/);
  assert.match(workflow, /needs: full-verify-web-vitest/);
});
