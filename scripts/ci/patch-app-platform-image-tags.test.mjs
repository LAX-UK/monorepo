import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyTagMapToSpec,
  deploymentIdFromAppsUpdate,
  sanitizeIngressForDoUpdate,
} from "./patch-app-platform-image-tags.mjs";

describe("applyTagMapToSpec", () => {
  it("updates only named components", () => {
    const spec = {
      services: [
        { name: "api", image: { tag: "old-api" } },
        { name: "web", image: { tag: "old-web" } },
      ],
    };
    const nextSha = "c".repeat(40);
    const next = applyTagMapToSpec(spec, { api: nextSha });
    assert.equal(next.services[0].image.tag, nextSha);
    assert.equal(next.services[1].image.tag, "old-web");
  });

  it("drops duplicate catch-all ingress rules when host-scoped rules exist", () => {
    const spec = {
      ingress: {
        rules: [
          {
            component: { name: "api" },
            match: { authority: { exact: "test-api.lax.bid" }, path: { prefix: "/" } },
          },
          {
            component: { name: "shop-admin" },
            match: {
              authority: { exact: "test-shop-admin.lax.bid" },
              path: { prefix: "/" },
            },
          },
          { component: { name: "api" }, match: { path: { prefix: "/" } } },
          { component: { name: "shop-admin" }, match: { path: { prefix: "/" } } },
        ],
      },
    };
    const next = sanitizeIngressForDoUpdate(spec);
    assert.equal(next.ingress.rules.length, 2);
    assert.deepEqual(next.ingress.rules.map((rule) => rule.component.name).sort(), [
      "api",
      "shop-admin",
    ]);
    assert.ok(next.ingress.rules.every((rule) => rule.match.authority?.exact));
  });

  it("reads pending deployment id from apps update json", () => {
    const id = deploymentIdFromAppsUpdate(
      JSON.stringify([{ pending_deployment: { id: "dep-123" } }]),
    );
    assert.equal(id, "dep-123");
  });
});
