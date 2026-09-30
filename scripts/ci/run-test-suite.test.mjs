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

test("CI runs web vitest on parallel matrix shards", () => {
  const workflow = readFileSync(join(root, ".github/workflows/ci.yml"), "utf8");
  assert.match(workflow, /web-vitest:/);
  assert.match(workflow, /shard: \[1, 2, 3, 4\]/);
  assert.doesNotMatch(workflow, /full-verify-web-vitest:/);
  assert.doesNotMatch(workflow, /full-verify:/);
  assert.match(workflow, /build --filter=@auction\/web\^\.\.\./);
});

test("run-test-suite avoids next build before web vitest", () => {
  const source = readFileSync(join(root, "scripts/ci/run-test-suite.mjs"), "utf8");
  assert.match(source, /--filter=@auction\/web\^\.\.\./);
  assert.doesNotMatch(source, /--filter=@auction\/web\.\.\./);
});
