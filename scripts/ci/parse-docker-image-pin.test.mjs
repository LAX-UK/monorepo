import assert from "node:assert/strict";
import test from "node:test";
import { parseDockerImagePin } from "./parse-docker-image-pin.mjs";

test("parseDockerImagePin accepts sha256 digest pins", () => {
  const sha = "a".repeat(40);
  const digest = `sha256:${"b".repeat(64)}`;
  assert.deepEqual(parseDockerImagePin(`${sha}@${digest}`), { sha, digest });
});

test("parseDockerImagePin rejects malformed pins", () => {
  assert.throws(() => parseDockerImagePin("short@sha256:abc"), /40-char-sha/);
});
