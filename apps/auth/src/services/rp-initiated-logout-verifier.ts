import { REGISTERED_OIDC_CLIENTS, type RegisteredOidcClientId } from "@auction/identity-contracts";
import { type JWTPayload, compactVerify, createLocalJWKSet, decodeJwt, jwtVerify } from "jose";

export type LogoutVerificationJwks = {
  getJwks(): Promise<{ id: string; publicKey: string; alg?: string | undefined }[]>;
};

export type LogoutVerificationResult = {
  subjectId: string;
  sessionId: string;
  clientId: RegisteredOidcClientId;
  expired: boolean;
};

const DEFAULT_MAX_HINT_AGE_SECONDS = 86_400;

export class RpInitiatedLogoutVerifier {
  constructor(
    private readonly issuer: string,
    private readonly jwks: LogoutVerificationJwks,
    private readonly now: () => Date = () => new Date(),
    private readonly maxHintAgeSeconds = DEFAULT_MAX_HINT_AGE_SECONDS,
  ) {}

  async verify(input: {
    idTokenHint: string;
    clientId?: RegisteredOidcClientId | undefined;
  }): Promise<LogoutVerificationResult | null> {
    try {
      const keys = await this.loadKeys();
      const normalizedIssuer = this.issuer.replace(/\/+$/, "");
      const verifiedPayload = await this.verifyPayload(
        input.idTokenHint,
        keys,
        normalizedIssuer,
        input.clientId,
      );
      if (!verifiedPayload) return null;
      const { expired, payload } = verifiedPayload;

      const clientId = this.resolveClientId(payload, input.clientId);
      if (!clientId) return null;
      if (!payload.sub || typeof payload.sid !== "string" || payload.sid.length === 0) {
        return null;
      }
      if (!this.isHintAgeBounded(payload)) return null;

      return { subjectId: payload.sub, sessionId: payload.sid, clientId, expired };
    } catch {
      return null;
    }
  }

  private async loadKeys() {
    const stored = await this.jwks.getJwks();
    return stored.map((key) => ({
      ...(JSON.parse(key.publicKey) as Record<string, unknown>),
      kid: key.id,
      alg: key.alg ?? "RS256",
      use: "sig",
    }));
  }

  private async verifyPayload(
    idTokenHint: string,
    keys: Record<string, unknown>[],
    issuer: string,
    expectedClientId?: RegisteredOidcClientId,
  ): Promise<{ payload: JWTPayload; expired: boolean } | null> {
    const verifyOptions = {
      issuer,
      algorithms: ["RS256"],
      ...(expectedClientId ? { audience: expectedClientId } : {}),
    };
    try {
      const { payload } = await jwtVerify(idTokenHint, createLocalJWKSet({ keys }), verifyOptions);
      return { payload, expired: false };
    } catch (error) {
      if (!isExpiredJwtError(error)) return null;
      try {
        await compactVerify(idTokenHint, createLocalJWKSet({ keys }));
      } catch {
        return null;
      }
      const payload = decodeJwt(idTokenHint);
      if (payload.iss?.replace(/\/+$/, "") !== issuer) return null;
      const audience = singleAudience(payload.aud);
      if (!audience) return null;
      if (expectedClientId && audience !== expectedClientId) return null;
      if (!(audience in REGISTERED_OIDC_CLIENTS)) return null;
      return { payload, expired: true };
    }
  }

  private resolveClientId(
    payload: JWTPayload,
    expectedClientId?: RegisteredOidcClientId,
  ): RegisteredOidcClientId | null {
    const audience = singleAudience(payload.aud);
    if (!audience || !(audience in REGISTERED_OIDC_CLIENTS)) return null;
    const clientId = audience as RegisteredOidcClientId;
    if (expectedClientId && expectedClientId !== clientId) return null;
    return clientId;
  }

  private isHintAgeBounded(payload: JWTPayload): boolean {
    if (typeof payload.iat !== "number") return false;
    const nowSeconds = Math.floor(this.now().getTime() / 1_000);
    const age = nowSeconds - payload.iat;
    return age >= 0 && age <= this.maxHintAgeSeconds;
  }
}

function singleAudience(aud: JWTPayload["aud"]): string | null {
  if (typeof aud === "string") return aud;
  if (Array.isArray(aud) && aud.length === 1 && typeof aud[0] === "string") return aud[0];
  return null;
}

function isExpiredJwtError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ERR_JWT_EXPIRED"
  );
}
