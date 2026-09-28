import assert from "node:assert/strict";
import test from "node:test";
import { readWebImageTagFromSpec, resolveAppImageTag } from "./resolve-app-image-tag.mjs";

test("resolveAppImageTag prefers explicit input SHA", () => {
  const sha = "a9eb88a52fbf2d13474cd6707e615905d6cec20d";
  assert.equal(resolveAppImageTag({ inputTag: sha, liveTag: "test" }), sha);
});

test("resolveAppImageTag uses live web tag when input is empty", () => {
  const sha = "4533800029d2f982a1b605dc92739301918adc02";
  assert.equal(resolveAppImageTag({ inputTag: "", liveTag: sha }), sha);
});

test("resolveAppImageTag rejects rolling env tags without input", () => {
  assert.throws(
    () => resolveAppImageTag({ inputTag: "", liveTag: "test" }),
    /40-character git SHA/,
  );
});

test("readWebImageTagFromSpec reads web service image tag", () => {
  assert.equal(
    readWebImageTagFromSpec({
      services: [
        { name: "api", image: { tag: "ignored" } },
        { name: "web", image: { tag: "abc" } },
      ],
    }),
    "abc",
  );
});
