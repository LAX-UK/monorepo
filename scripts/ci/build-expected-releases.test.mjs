import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildExpectedReleases, buildReadinessUrls } from "./build-expected-releases.mjs";

describe("buildExpectedReleases", () => {
  const sha = "a".repeat(40);
  const old = "b".repeat(40);

  it("builds readiness URLs only for components pinned to target sha", () => {
    const sha = "a".repeat(40);
    const urls = buildReadinessUrls({
      targetSha: sha,
      tagMap: { api: sha, web: "b".repeat(40) },
    });
    assert.deepEqual(urls, ["https://test-api.lax.bid/health/ready"]);
  });

  it("expects release only for components pinned to target sha", () => {
    const expected = buildExpectedReleases({
      targetSha: sha,
      tagMap: { api: sha, web: old },
    });
    assert.equal(expected["https://test-api.lax.bid/health/ready"], sha);
    assert.equal(expected["https://test.lax.bid/api/health/ready"], undefined);
  });

  it("expects the account release on its readiness route only when account is pinned", () => {
    const pinned = buildExpectedReleases({ targetSha: sha, tagMap: { account: sha } });
    assert.deepEqual(pinned, { "https://test-account.lax.bid/health/ready": sha });
    const unpinned = buildReadinessUrls({ targetSha: sha, tagMap: { account: old } });
    assert.deepEqual(unpinned, []);
  });

  it("includes shop readiness when only shop-api is pinned", () => {
    const urls = buildReadinessUrls({
      targetSha: sha,
      tagMap: { "shop-api": sha, shop: old },
    });
    assert.ok(urls.includes("https://test-shop.lax.bid/health/ready"));
  });
});
