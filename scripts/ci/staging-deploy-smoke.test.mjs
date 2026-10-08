import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pinsForTargetSha, smokeProbes } from "./staging-deploy-smoke.mjs";

describe("smokeProbes", () => {
  it("enables auth and shop probes independently", () => {
    assert.deepEqual(smokeProbes({ smokeAuth: true, smokeShop: false }).authDiscovery, true);
    assert.deepEqual(smokeProbes({ smokeAuth: true, smokeShop: false }).shopStripeWebhook, false);
    assert.deepEqual(smokeProbes({ smokeAuth: false, smokeShop: true }).shopAdminOidc, true);
  });

  it("skips readiness when component tag unchanged", () => {
    const sha = "a".repeat(40);
    const pins = pinsForTargetSha({ api: sha, web: "b".repeat(40) }, sha);
    const probes = smokeProbes({ smokeAuth: false, smokeShop: false, ...pins });
    assert.equal(probes.readinessApi, true);
    assert.equal(probes.readinessWeb, false);
  });
});
