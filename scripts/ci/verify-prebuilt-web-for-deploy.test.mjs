import assert from "node:assert/strict";
import test from "node:test";
import { digestForTag } from "./registry-tag-poll.mjs";

test("digestForTag finds matching tag entry", () => {
  const tags = [
    { tag: "abc", manifest_digest: "sha256:111" },
    { tag: "test", manifest_digest: "sha256:111" },
  ];
  assert.equal(digestForTag(tags, "abc"), "sha256:111");
  assert.equal(digestForTag(tags, "missing"), null);
});
