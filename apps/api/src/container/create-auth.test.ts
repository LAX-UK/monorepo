import type { Database } from "@auction/db";
import { beforeEach, describe, expect, it, vi } from "vitest";

const bearerRejectionCode = vi.fn();
const verifyBearerToken = vi.fn();
vi.mock("@auction/auth/token-verifier", () => ({ bearerRejectionCode, verifyBearerToken }));

const { createContainerAuthenticator } = await import("./create-auth.js");
const { BidContextEnrichedAuthenticator, IdentityPrincipalAuthenticator } = await import(
  "../infrastructure/bid-context-enriched-authenticator.js"
);
const { JwtAuthenticator } = await import("../infrastructure/jwt-authenticator.js");

const env = {
  OIDC_ISSUER_URL: "https://auth.lax.bid",
  JWT_AUDIENCE: "lax-bid-api",
  ALLOW_LEGACY_LAX_API_AUDIENCE: false,
} as Parameters<typeof createContainerAuthenticator>[0]["env"];

describe("production auth wiring", () => {
  beforeEach(() => {
    bearerRejectionCode.mockReset();
    verifyBearerToken.mockReset();
    vi.restoreAllMocks();
  });

  it.each(["token_key_unknown", "token_expired"] as const)(
    "diagnoses %s through the enriched, identity and JWT authenticators in turn",
    async (code) => {
      const enriched = vi.spyOn(BidContextEnrichedAuthenticator.prototype, "diagnoseRejection");
      const identity = vi.spyOn(IdentityPrincipalAuthenticator.prototype, "diagnoseRejection");
      const jwt = vi.spyOn(JwtAuthenticator.prototype, "diagnoseRejection");
      bearerRejectionCode.mockResolvedValue(code);
      const authenticator = createContainerAuthenticator({ env, db: {} as Database });
      const headers = new Headers({ authorization: "Bearer retired.jwt" });

      await expect(authenticator.diagnoseRejection?.(headers)).resolves.toBe(code);

      expect(authenticator).toBeInstanceOf(BidContextEnrichedAuthenticator);
      for (const hop of [enriched, identity, jwt])
        expect(hop).toHaveBeenCalledExactlyOnceWith(headers);
      expect(bearerRejectionCode).toHaveBeenCalledWith({
        authorization: "Bearer retired.jwt",
        jwksUrl: "https://auth.lax.bid/.well-known/jwks.json",
        issuer: "https://auth.lax.bid",
        audience: "lax-bid-api",
        clockToleranceSeconds: 5,
      });
    },
  );

  it("reports nothing when the token is simply invalid", async () => {
    bearerRejectionCode.mockResolvedValue(null);
    const authenticator = createContainerAuthenticator({ env, db: {} as Database });
    await expect(
      authenticator.diagnoseRejection?.(new Headers({ authorization: "Bearer bad.jwt" })),
    ).resolves.toBeNull();
  });
});
