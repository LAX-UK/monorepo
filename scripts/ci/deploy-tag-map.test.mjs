import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDeployTagMap } from "./deploy-tag-map.mjs";

describe("buildDeployTagMap", () => {
  const sha = "a".repeat(40);
  const old = "b".repeat(40);
  const live = { api: old, migrate: old, "shop-api": old };

  it("pins migrate when built but not in affected", () => {
    const map = buildDeployTagMap({
      liveTags: live,
      affected: ["shop-api"],
      buildComponents: ["shop-api", "migrate"],
      targetSha: sha,
    });
    assert.equal(map["shop-api"], sha);
    assert.equal(map.migrate, sha);
    assert.equal(map.api, old);
  });

  it("keeps art-identity on the shop-identity image it runs", () => {
    const stale = "c".repeat(40);
    const liveTags = { "shop-identity": old, "art-identity": stale };
    const rebuilt = buildDeployTagMap({
      liveTags,
      affected: ["shop-identity"],
      buildComponents: ["shop-identity", "migrate"],
      targetSha: sha,
    });
    assert.equal(rebuilt["art-identity"], sha);
    const unchanged = buildDeployTagMap({
      liveTags,
      affected: ["shop-api"],
      buildComponents: ["shop-api", "migrate"],
      targetSha: sha,
    });
    assert.equal(unchanged["art-identity"], old);
  });

  it("does not add art-identity to an app that has none", () => {
    const map = buildDeployTagMap({
      liveTags: { "shop-identity": old },
      affected: ["shop-identity"],
      buildComponents: ["shop-identity"],
      targetSha: sha,
    });
    assert.equal("art-identity" in map, false);
  });
});
