import assert from "node:assert/strict";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { findDeadMocksForTestFile } from "./check-test-mocks.mjs";

const FIXTURE_ROOT = resolve(fileURLToPath(import.meta.url), "..", "check-test-mocks.fixtures");

test("findDeadMocksForTestFile catches vi.mock(next/image) with no transitive import", () => {
  const testFile = join(FIXTURE_ROOT, "dead-next-image.test.tsx");
  const dead = findDeadMocksForTestFile(testFile, FIXTURE_ROOT);
  assert.deepEqual(dead, ["next/image"]);
});

test("findDeadMocksForTestFile passes when next/image is imported in the graph", () => {
  const repoRoot = resolve(fileURLToPath(import.meta.url), "..", "..");
  const testFile = join(repoRoot, "apps/web/src/components/ui/media-image.test.tsx");
  const srcRoot = join(repoRoot, "apps/web/src");
  const dead = findDeadMocksForTestFile(testFile, srcRoot);
  assert.equal(dead.length, 0);
});
