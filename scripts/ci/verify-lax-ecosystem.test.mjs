import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("LAX ecosystem conformance", () => {
  it("documents boundary and env SSOT", () => {
    const boundary = readFileSync(
      join(root, "docs/architecture/11-lax-ecosystem-boundary.md"),
      "utf8",
    );
    assert.match(boundary, /@auction\/lax-ecosystem/);
    assert.match(boundary, /Account chrome contract/);

    const env = readFileSync(join(root, ".env.example"), "utf8");
    assert.match(env, /LAX_BID_PUBLIC_URL/);
    assert.match(env, /LAX_SHOP_STOREFRONT_URL/);
  });

  it("wires composition roots without client session fetch in Shop header", () => {
    const shopHeader = readFileSync(
      join(root, "apps/shop/src/components/header/shop-header.tsx"),
      "utf8",
    );
    assert.match(shopHeader, /loadShopAccountChromeState/);
    assert.doesNotMatch(shopHeader, /use client/);

    const client = readFileSync(
      join(root, "apps/shop/src/components/header/shop-header.client.tsx"),
      "utf8",
    );
    assert.match(client, /AccountChromeState/);
    assert.doesNotMatch(client, /shopIdentityUrl\("\/me"\)/);
  });

  it("allows Shop to import lax-ecosystem in layer guard", () => {
    const layers = readFileSync(join(root, "scripts/check-layers.mjs"), "utf8");
    assert.match(layers, /@auction\/lax-ecosystem/);
  });

  it("exposes LAX Account v1 contract types", () => {
    const contract = readFileSync(
      join(root, "packages/lax-ecosystem/src/lax-account-contract.v1.ts"),
      "utf8",
    );
    assert.match(contract, /LaxAccountPortalSummaryV1/);
    assert.match(contract, /LAX_ACCOUNT_CONTRACT_VERSION/);
  });
});
