import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveLiveTerraformImageTags } from "./resolve-live-app-image-tags.mjs";

const sha = (c) => c.repeat(40);

describe("resolveLiveTerraformImageTags", () => {
  it("maps live component tags to terraform variables", () => {
    const tags = resolveLiveTerraformImageTags({
      services: [
        { name: "web", image: { tag: sha("a") } },
        { name: "auth", image: { tag: sha("b") } },
        { name: "shop", image: { tag: sha("c") } },
        { name: "shop-identity", image: { tag: sha("d") } },
        { name: "shop-api", image: { tag: sha("e") } },
        { name: "shop-admin", image: { tag: sha("f") } },
      ],
    });
    assert.equal(tags.app_image_tag, sha("a"));
    assert.equal(tags.shop_image_tag, sha("c"));
    assert.equal(tags.shop_identity_image_tag, sha("d"));
    assert.equal(tags.shop_api_image_tag, sha("e"));
    assert.equal(tags.shop_admin_image_tag, sha("f"));
  });

  it("allows shop-admin override when infra health path needs a newer image", () => {
    const tags = resolveLiveTerraformImageTags(
      {
        services: [{ name: "shop-admin", image: { tag: sha("f") } }],
      },
      { inputShopAdminImageTag: sha("9") },
    );
    assert.equal(tags.shop_admin_image_tag, sha("9"));
  });
});
