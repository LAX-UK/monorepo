import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { coalesceImageSha, resolveLiveTerraformImageTags } from "./resolve-live-app-image-tags.mjs";

const sha = (c) => c.repeat(40);

const liveServices = [
  { name: "web", image: { tag: sha("a") } },
  { name: "auth", image: { tag: sha("b") } },
  { name: "shop", image: { tag: sha("c") } },
  { name: "shop-identity", image: { tag: sha("d") } },
  { name: "shop-api", image: { tag: sha("e") } },
  { name: "shop-admin", image: { tag: sha("f") } },
];

describe("coalesceImageSha", () => {
  it("prefers the first valid SHA", () => {
    assert.equal(coalesceImageSha("", sha("a"), sha("b")), sha("a"));
    assert.equal(coalesceImageSha(sha("c"), sha("a")), sha("c"));
  });
});

describe("resolveLiveTerraformImageTags", () => {
  it("maps live component tags to terraform variables", () => {
    const tags = resolveLiveTerraformImageTags({
      services: [
        ...liveServices,
        { name: "account", image: { tag: sha("7") } },
        { name: "art", image: { tag: sha("2") } },
      ],
    });
    assert.equal(tags.app_image_tag, sha("a"));
    assert.equal(tags.shop_image_tag, sha("c"));
    assert.equal(tags.shop_identity_image_tag, sha("d"));
    assert.equal(tags.shop_api_image_tag, sha("e"));
    assert.equal(tags.shop_admin_image_tag, sha("f"));
    assert.equal(tags.account_image_tag, sha("7"));
    assert.equal(tags.art_image_tag, sha("2"));
  });

  it("allows shop-admin override when infra health path needs a newer image", () => {
    const tags = resolveLiveTerraformImageTags(
      {
        services: [
          ...liveServices,
          { name: "account", image: { tag: sha("7") } },
          { name: "art", image: { tag: sha("2") } },
        ],
      },
      { inputShopAdminImageTag: sha("9") },
    );
    assert.equal(tags.shop_admin_image_tag, sha("9"));
  });

  it("allows shop-api override from workflow input", () => {
    const tags = resolveLiveTerraformImageTags(
      {
        services: [
          ...liveServices,
          { name: "account", image: { tag: sha("7") } },
          { name: "art", image: { tag: sha("2") } },
        ],
      },
      { inputShopApiImageTag: sha("0") },
    );
    assert.equal(tags.shop_api_image_tag, sha("0"));
  });

  it("uses the account input before the account component exists", () => {
    const tags = resolveLiveTerraformImageTags(
      { services: liveServices },
      { inputAccountImageTag: sha("8") },
    );
    assert.equal(tags.account_image_tag, sha("8"));
    assert.equal(tags.art_image_tag, "");
  });

  it("uses the art input before the art component exists", () => {
    const tags = resolveLiveTerraformImageTags(
      { services: liveServices },
      { inputArtImageTag: sha("1"), inputAccountImageTag: sha("8") },
    );
    assert.equal(tags.art_image_tag, sha("1"));
  });

  it("fails closed when account is neither live nor provided", () => {
    assert.throws(
      () => resolveLiveTerraformImageTags({ services: liveServices }),
      /account image tag .*pass account_sha/,
    );
  });

  it("keeps each monorepo component on its own live tag when no app_image_tag is given", () => {
    const tags = resolveLiveTerraformImageTags({
      services: [
        ...liveServices,
        { name: "account", image: { tag: sha("7") } },
        { name: "api", image: { tag: sha("a") } },
        { name: "ws", image: { tag: sha("2") } },
      ],
      workers: [{ name: "worker", image: { tag: sha("a") } }],
      jobs: [{ name: "migrate", image: { tag: sha("a") } }],
    });
    assert.equal(tags.app_image_tag, sha("a"));
    assert.equal(tags.web_image_tag, sha("a"));
    assert.equal(tags.api_image_tag, sha("a"));
    assert.equal(tags.ws_image_tag, sha("2"));
    assert.equal(tags.worker_image_tag, sha("a"));
    assert.equal(tags.migrate_image_tag, sha("a"));
  });

  it("leaves per-component tags empty when app_image_tag pins every component", () => {
    const tags = resolveLiveTerraformImageTags(
      {
        services: [
          ...liveServices,
          { name: "account", image: { tag: sha("7") } },
          { name: "ws", image: { tag: sha("2") } },
        ],
      },
      { inputAppImageTag: sha("9") },
    );
    assert.equal(tags.app_image_tag, sha("9"));
    for (const name of ["web", "api", "ws", "worker", "migrate"]) {
      assert.equal(tags[`${name}_image_tag`], "");
    }
  });

  it("keeps shop, shop-api, shop-admin, shop-identity, account and art on their live SHAs when app_image_tag is pinned", () => {
    const tags = resolveLiveTerraformImageTags(
      {
        services: [
          ...liveServices,
          { name: "account", image: { tag: sha("7") } },
          { name: "art", image: { tag: sha("2") } },
          { name: "api", image: { tag: sha("3") } },
        ],
        workers: [{ name: "worker", image: { tag: sha("3") } }],
        jobs: [{ name: "migrate", image: { tag: sha("3") } }],
      },
      { inputAppImageTag: sha("9") },
    );
    assert.equal(tags.app_image_tag, sha("9"));
    // The pin moves only the monorepo app components; every other component stays as it runs.
    assert.deepEqual(
      {
        shop: tags.shop_image_tag,
        shop_api: tags.shop_api_image_tag,
        shop_admin: tags.shop_admin_image_tag,
        shop_identity: tags.shop_identity_image_tag,
        account: tags.account_image_tag,
        art: tags.art_image_tag,
      },
      {
        shop: sha("c"),
        shop_api: sha("e"),
        shop_admin: sha("f"),
        shop_identity: sha("d"),
        account: sha("7"),
        art: sha("2"),
      },
    );
  });

  it("falls back to the shared tag for a component with a rolling live tag", () => {
    const tags = resolveLiveTerraformImageTags({
      services: [
        ...liveServices,
        { name: "account", image: { tag: sha("7") } },
        { name: "ws", image: { tag: "test" } },
      ],
    });
    assert.equal(tags.ws_image_tag, "");
  });
});
