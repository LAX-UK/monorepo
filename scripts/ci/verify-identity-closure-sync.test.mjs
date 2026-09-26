import assert from "node:assert/strict";
import test from "node:test";
import { closureRefOrDefault } from "./verify-identity-closure-sync.mjs";

test("closureRefOrDefault treats blank env as main", () => {
  assert.equal(closureRefOrDefault(undefined, ""), "main");
  assert.equal(closureRefOrDefault(undefined, "   "), "main");
  assert.equal(closureRefOrDefault(undefined, undefined), "main");
});

test("closureRefOrDefault prefers explicit ref over env", () => {
  assert.equal(
    closureRefOrDefault("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", ""),
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  );
  assert.equal(closureRefOrDefault("main", "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"), "main");
});
