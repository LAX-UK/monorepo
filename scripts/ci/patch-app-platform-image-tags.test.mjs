import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyTagMapToSpec } from "./patch-app-platform-image-tags.mjs";

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
});
