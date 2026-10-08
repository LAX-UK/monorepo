import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildExpectedReleases } from "./build-expected-releases.mjs";

describe("buildExpectedReleases", () => {
  const sha = "a".repeat(40);
  const old = "b".repeat(40);

  it("expects release only for components pinned to target sha", () => {
    const expected = buildExpectedReleases({
      targetSha: sha,
      tagMap: { api: sha, web: old },
    });
    assert.equal(expected["https://test-api.lax.bid/health/ready"], sha);
    assert.equal(expected["https://test.lax.bid/api/health/ready"], undefined);
  });
});
