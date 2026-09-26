import { describe, expect, it, vi } from "vitest";
import { resolveSilentFedcmBootstrapProps } from "./resolve-silent-fedcm-props.server";

vi.mock("@/lib/bff/config.server", () => ({
  bffConfig: () => ({ issuer: "https://auth.test" }),
}));

const fedcmEnv = (overrides: Record<string, string>): NodeJS.ProcessEnv =>
  ({ ...process.env, ...overrides }) as NodeJS.ProcessEnv;

describe("resolveSilentFedcmBootstrapProps", () => {
  it("returns null when flags are off", () => {
    expect(
      resolveSilentFedcmBootstrapProps(
        { get: () => undefined },
        false,
        fedcmEnv({ SILENT_SSO_ENABLED: "false", FEDCM_ENABLED: "false" }),
      ),
    ).toBeNull();
  });

  it("returns config when eligible", () => {
    const props = resolveSilentFedcmBootstrapProps(
      { get: () => undefined },
      false,
      fedcmEnv({ SILENT_SSO_ENABLED: "true", FEDCM_ENABLED: "true" }),
    );
    expect(props).toEqual({
      configUrl: "https://auth.test/fedcm/config.json",
      clientId: "lax-bid-web",
    });
  });

  it("returns null when suppressed", () => {
    expect(
      resolveSilentFedcmBootstrapProps(
        {
          get: (name) => (name === "bid_sso_suppressed" ? { value: "1" } : undefined),
        },
        false,
        fedcmEnv({ SILENT_SSO_ENABLED: "true", FEDCM_ENABLED: "true" }),
      ),
    ).toBeNull();
  });
});
