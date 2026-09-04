import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { readRequiredNodeMajor, readRequiredNodeVersion } from "./require-node-version.mjs";

test("readRequiredNodeVersion reads .nvmrc from repo root", () => {
  assert.equal(readRequiredNodeVersion(), "22");
  assert.equal(readRequiredNodeMajor(), "22");
});

test("readRequiredNodeVersion reads a custom repo root", () => {
  const dir = mkdtempSync(join(tmpdir(), "nvmrc-"));
  writeFileSync(join(dir, ".nvmrc"), "20.11.1\n");
  assert.equal(readRequiredNodeVersion(dir), "20.11.1");
  assert.equal(readRequiredNodeMajor(dir), "20");
});
