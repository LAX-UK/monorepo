import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { REGISTERED_OIDC_CLIENTS, REGISTERED_OIDC_CLIENT_IDS } from "./clients.js";
import { buildOidcDiscoveryDocument } from "./discovery.js";
import { LAX_RESOURCES, allRegisteredOidcScopes } from "./resources.js";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures");

function loadFixture<T>(name: string): T {
  return JSON.parse(readFileSync(join(fixturesDir, name), "utf8")) as T;
}

describe("identity-contracts consumer fixtures", () => {
  it("matches the frozen OIDC discovery document fixture", () => {
    const fixture =
      loadFixture<ReturnType<typeof buildOidcDiscoveryDocument>>("oidc-discovery.v1.json");
    expect(buildOidcDiscoveryDocument("https://auth.lax.bid")).toEqual(fixture);
  });

  it("matches the registered OIDC client fixture", () => {
    const fixture = loadFixture<{
      clientIds: string[];
      bidWeb: {
        allowedResources: string[];
        allowedScopes: string[];
        backchannelLogoutUri: string;
      };
      shopWeb: {
        allowedResources: string[];
        allowedScopes: string[];
        backchannelLogoutUri: string;
      };
      wsMobile: { allowedResources: string[]; allowedScopes: string[] };
    }>("registered-clients.v1.json");

    expect(Object.keys(REGISTERED_OIDC_CLIENTS).sort()).toEqual(fixture.clientIds.sort());

    const bid = REGISTERED_OIDC_CLIENTS[REGISTERED_OIDC_CLIENT_IDS.LAX_BID_WEB];
    expect(bid.allowedResources).toEqual(fixture.bidWeb.allowedResources);
    expect(bid.allowedScopes).toEqual(fixture.bidWeb.allowedScopes);
    expect(bid.backchannelLogoutUri).toBe(fixture.bidWeb.backchannelLogoutUri);

    const shop = REGISTERED_OIDC_CLIENTS[REGISTERED_OIDC_CLIENT_IDS.LAX_SHOP_WEB];
    expect(shop.allowedResources).toEqual(fixture.shopWeb.allowedResources);
    expect(shop.allowedScopes).toEqual(fixture.shopWeb.allowedScopes);
    expect(shop.backchannelLogoutUri).toBe(fixture.shopWeb.backchannelLogoutUri);

    const mobile = REGISTERED_OIDC_CLIENTS[REGISTERED_OIDC_CLIENT_IDS.WS_MOBILE];
    expect(mobile.allowedResources).toEqual(fixture.wsMobile.allowedResources);
    expect(mobile.allowedScopes).toEqual(fixture.wsMobile.allowedScopes);
  });

  it("matches the LAX resource registry fixture", () => {
    const fixture = loadFixture<{
      resources: typeof LAX_RESOURCES;
      derivedOidcScopes: ReturnType<typeof allRegisteredOidcScopes>;
    }>("lax-resources.v1.json");

    expect(LAX_RESOURCES).toEqual(fixture.resources);
    expect(allRegisteredOidcScopes()).toEqual(fixture.derivedOidcScopes);
  });
});
