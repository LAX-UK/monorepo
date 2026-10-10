import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveLiveTerraformImageTags } from "./resolve-live-app-image-tags.mjs";

const sha = (c) => c.repeat(40);

const liveServices = [
  { name: "web", image: { tag: sha("a") } },
  { name: "auth", image: { tag: sha("b") } },
  { name: "shop", image: { tag: sha("c") } },
  { name: "shop-identity", image: { tag: sha("d") } },
  { name: "shop-api", image: { tag: sha("e") } },
  { name: "shop-admin", image: { tag: sha("f") } },
];

describe("resolveLiveTerraformImageTags", () => {
  it("maps live component tags to terraform variables", () => {
    const tags = resolveLiveTerraformImageTags({
      services: [...liveServices, { name: "account", image: { tag: sha("7") } }],
    });
    assert.equal(tags.app_image_tag, sha("a"));
    assert.equal(tags.shop_image_tag, sha("c"));
    assert.equal(tags.shop_identity_image_tag, sha("d"));
    assert.equal(tags.shop_api_image_tag, sha("e"));
    assert.equal(tags.shop_admin_image_tag, sha("f"));
    assert.equal(tags.account_image_tag, sha("7"));
  });

  it("allows shop-admin override when infra health path needs a newer image", () => {
    const tags = resolveLiveTerraformImageTags(
      { services: [...liveServices, { name: "account", image: { tag: sha("7") } }] },
      { inputShopAdminImageTag: sha("9") },
    );
    assert.equal(tags.shop_admin_image_tag, sha("9"));
  });

  it("uses the account input before the account component exists", () => {
    const tags = resolveLiveTerraformImageTags(
      { services: liveServices },
      { inputAccountImageTag: sha("8") },
    );
    assert.equal(tags.account_image_tag, sha("8"));
  });

  it("fails closed when account is neither live nor provided", () => {
    assert.throws(
      () => resolveLiveTerraformImageTags({ services: liveServices }),
      /account image tag .*pass account_sha/,
    );
  });
});
