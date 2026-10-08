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
});
