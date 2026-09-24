import { IdentityRejectedError } from "@auction/identity-rp";
import { describe, expect, it, vi } from "vitest";
import { ShopIdentityReauthRequiredError } from "../errors/shop-identity-reauth.error.js";
import { ShopIdentityUpstreamError } from "../errors/shop-identity-upstream.error.js";
import { resolveOidcDiscovery } from "../oidc.js";
import { createOidcRefreshClient } from "./oidc-refresh.client.js";

const refreshOAuthTokens = vi.hoisted(() => vi.fn());

vi.mock("../oidc.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../oidc.js")>();
  return { ...actual, refreshOAuthTokens };
});

const discovery = resolveOidcDiscovery("https://auth.example");

describe("createOidcRefreshClient", () => {
  it("maps invalid_grant to reauth required", async () => {
    refreshOAuthTokens.mockRejectedValue(
      new IdentityRejectedError(400, "bad grant", "invalid_grant"),
    );
    const client = createOidcRefreshClient({
      discovery,
      clientId: "client",
      clientSecret: "secret",
      now: () => 1_000,
    });

    await expect(client.refresh("refresh-token")).rejects.toBeInstanceOf(
      ShopIdentityReauthRequiredError,
    );
  });

  it("maps other issuer rejections to upstream errors", async () => {
    refreshOAuthTokens.mockRejectedValue(new IdentityRejectedError(401, "unauthorized"));
    const client = createOidcRefreshClient({
      discovery,
      clientId: "client",
      clientSecret: "secret",
    });

    await expect(client.refresh("refresh-token")).rejects.toMatchObject({
      name: "ShopIdentityUpstreamError",
    });
    await expect(client.refresh("refresh-token")).rejects.toBeInstanceOf(ShopIdentityUpstreamError);
  });
});
