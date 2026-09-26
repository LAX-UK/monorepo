import { SHOP_SILENT_SSO_COOKIE_PREFIX } from "@/lib/silent-sign-in/config";
import { createSilentSignInCookieSpec } from "@auction/identity-rp/silent-sign-in";
import { describe, expect, it, vi } from "vitest";
import { resolveShopSilentFedcmBootstrapProps } from "./resolve-silent-fedcm-props.server";

vi.mock("@/lib/shop-identity.server", () => ({
  shopIdentityBaseUrl: () => "http://localhost:3010",
}));

const SHOP_SILENT_SSO_COOKIE_NAMES = createSilentSignInCookieSpec(SHOP_SILENT_SSO_COOKIE_PREFIX);

const shopFedcmEnv = (overrides: Record<string, string>): NodeJS.ProcessEnv =>
  ({
    ...process.env,
    SILENT_SSO_ENABLED: "true",
    FEDCM_ENABLED: "true",
    IDENTITY_PUBLIC_BASE_URL: "https://identity.example",
    ...overrides,
  }) as NodeJS.ProcessEnv;

describe("resolveShopSilentFedcmBootstrapProps", () => {
  it("returns null when IDENTITY_PUBLIC_BASE_URL is unset", () => {
    const env = shopFedcmEnv({ IDENTITY_PUBLIC_BASE_URL: "" });
    expect(resolveShopSilentFedcmBootstrapProps([], false, env)).toBeNull();
  });

  it("returns null when suppressed", () => {
    expect(
      resolveShopSilentFedcmBootstrapProps(
        [{ name: SHOP_SILENT_SSO_COOKIE_NAMES.suppressed, value: "1" }],
        false,
        shopFedcmEnv({}),
      ),
    ).toBeNull();
  });

  it("returns FedCM config when eligible", () => {
    expect(resolveShopSilentFedcmBootstrapProps([], false, shopFedcmEnv({}))).toEqual({
      configUrl: "https://identity.example/fedcm/config.json",
      clientId: "lax-shop-web",
      identityBaseUrl: "http://localhost:3010",
    });
  });
});
