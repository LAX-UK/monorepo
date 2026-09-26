import { describe, expect, it, vi } from "vitest";
import { resolveSilentFedcmBootstrapProps } from "./resolve-silent-fedcm-props.server";

vi.mock("@/lib/bff/config.server", () => ({
  bffConfig: () => ({ issuer: "https://auth.test" }),
}));

describe("resolveSilentFedcmBootstrapProps", () => {
  it("returns null when flags are off", () => {
    expect(
      resolveSilentFedcmBootstrapProps({ get: () => undefined }, false, {
        SILENT_SSO_ENABLED: "false",
        FEDCM_ENABLED: "false",
      }),
    ).toBeNull();
  });

  it("returns config when eligible", () => {
    const props = resolveSilentFedcmBootstrapProps({ get: () => undefined }, false, {
      SILENT_SSO_ENABLED: "true",
      FEDCM_ENABLED: "true",
    });
    expect(props).toEqual({
      configUrl: "https://auth.test/fedcm/config.json",
      clientId: "lax-bid-web",
    });
  });

  it("returns null when suppressed", () => {
    expect(
      resolveSilentFedcmBootstrapProps(
        { get: (name) => (name === "bid_sso_suppressed" ? "1" : undefined) },
        false,
        { SILENT_SSO_ENABLED: "true", FEDCM_ENABLED: "true" },
      ),
    ).toBeNull();
  });
});
