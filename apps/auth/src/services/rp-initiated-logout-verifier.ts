import type { RegisteredOidcClientId } from "@auction/identity-contracts";
import { createLocalJWKSet, jwtVerify } from "jose";

export type LogoutVerificationJwks = {
  getJwks(): Promise<{ id: string; publicKey: string; alg?: string | undefined }[]>;
};

export class RpInitiatedLogoutVerifier {
  constructor(
    private readonly issuer: string,
    private readonly jwks: LogoutVerificationJwks,
  ) {}

  async verify(input: {
    idTokenHint: string;
    clientId: RegisteredOidcClientId;
  }): Promise<{ subjectId: string } | null> {
    try {
      const stored = await this.jwks.getJwks();
      const keys = stored.map((key) => ({
        ...(JSON.parse(key.publicKey) as Record<string, unknown>),
        kid: key.id,
        alg: key.alg ?? "RS256",
        use: "sig",
      }));
      const { payload } = await jwtVerify(input.idTokenHint, createLocalJWKSet({ keys }), {
        issuer: this.issuer.replace(/\/+$/, ""),
        audience: input.clientId,
        algorithms: ["RS256"],
      });
      return payload.sub ? { subjectId: payload.sub } : null;
    } catch {
      return null;
    }
  }
}
