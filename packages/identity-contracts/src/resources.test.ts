import { describe, expect, it } from "vitest";
import {
  LAX_RESOURCES,
  LAX_RESOURCE_IDS,
  allRegisteredOidcScopes,
  findLaxResource,
  findLaxResourceById,
  findLaxResourceByUri,
} from "./resources.js";

describe("LAX resource registry", () => {
  it("defines one audience and canonical URI per API resource", () => {
    expect(LAX_RESOURCES).toEqual({
      "lax-bid-api": {
        id: "lax-bid-api",
        uri: "https://api.lax.bid",
        allowedScopes: ["bid.read", "bid.write"],
      },
      "lax-ws": {
        id: "lax-ws",
        uri: "https://ws.lax.bid",
        allowedScopes: ["bid.read"],
      },
      "lax-shop-api": {
        id: "lax-shop-api",
        uri: "https://shop.lax.art/api",
        allowedScopes: ["shop.read", "shop.write"],
      },
    });
    expect(
      Object.values(LAX_RESOURCES).some((resource) => resource.uri.includes("lax.art/marketing")),
    ).toBe(false);
  });

  it("derives OIDC scopes from registered product resources", () => {
    expect(allRegisteredOidcScopes()).toEqual([
      "openid",
      "profile",
      "email",
      "offline_access",
      "bid.read",
      "bid.write",
      "shop.read",
      "shop.write",
    ]);
  });

  it("resolves only registered ids and canonical resource indicators", () => {
    expect(findLaxResource(LAX_RESOURCE_IDS.LAX_BID_API)?.id).toBe("lax-bid-api");
    expect(findLaxResource("https://shop.lax.art/api")?.id).toBe("lax-shop-api");
    expect(findLaxResourceById("https://shop.lax.art/api")).toBeUndefined();
    expect(findLaxResourceByUri(LAX_RESOURCE_IDS.LAX_BID_API)).toBeUndefined();
    expect(findLaxResourceByUri("https://shop.lax.art/api")?.id).toBe("lax-shop-api");
    expect(findLaxResource("https://attacker.example/api")).toBeUndefined();
  });
});
