import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rollbackAppPlatform } from "./digitalocean-app-rollback-api.mjs";

describe("rollbackAppPlatform", () => {
  it("fails when validate returns non-ok", async () => {
    const fetchImpl = async (url) => {
      if (String(url).includes("/rollback/validate")) {
        return { ok: false, status: 400, text: async () => "bad" };
      }
      throw new Error(`unexpected ${url}`);
    };
    await assert.rejects(
      () => rollbackAppPlatform({ token: "t", appId: "a", deploymentId: "d", fetchImpl }),
      /validate failed/,
    );
  });

  it("polls until ACTIVE then commits", async () => {
    let polls = 0;
    const fetchImpl = async (url, init) => {
      const u = String(url);
      if (u.includes("/rollback/validate")) {
        return { ok: true, json: async () => ({ valid: true }) };
      }
      if (u.endsWith("/rollback") && init?.method === "POST") {
        return { ok: true, json: async () => ({ deployment: { id: "new-dep" } }) };
      }
      if (u.includes("/deployments/new-dep")) {
        polls += 1;
        return {
          ok: true,
          json: async () => ({ deployment: { phase: polls >= 2 ? "ACTIVE" : "PENDING" } }),
        };
      }
      if (u.includes("/rollback/commit")) {
        return { ok: true, json: async () => ({}) };
      }
      throw new Error(u);
    };
    const result = await rollbackAppPlatform({
      token: "t",
      appId: "app",
      deploymentId: "old",
      fetchImpl,
      timeoutMs: 60_000,
    });
    assert.equal(result.rollbackDeploymentId, "new-dep");
    assert.equal(result.phase, "ACTIVE");
  });

  it("fails when validate returns valid false", async () => {
    const fetchImpl = async (url) => {
      if (String(url).includes("/rollback/validate")) {
        return { ok: true, json: async () => ({ valid: false, error: "nope" }) };
      }
      throw new Error(`unexpected ${url}`);
    };
    await assert.rejects(
      () => rollbackAppPlatform({ token: "t", appId: "a", deploymentId: "d", fetchImpl }),
      /validate rejected/,
    );
  });
});
