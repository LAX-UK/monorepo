import { decodeJwt } from "jose";
import type { IdentityJwtSigner } from "../infrastructure/identity-jwt-signer.ports.js";
import { type IdentitySessionClaimSource, oidcSessionClaims } from "./oidc-session-claims.js";
import { hashRefreshToken } from "./refresh-token-family.ports.js";

/**
 * What a refresh token needs to renew the ID token it was issued with: the sign-in it belongs to,
 * the client and subject it was issued for, and the identity claims of the original token.
 */
export type IdTokenContinuityRecord = {
  issuer: string;
  sid: string;
  subject: string;
  clientId: string;
  claims: Record<string, unknown>;
};

/** Keeps a continuity record against the refresh token currently able to renew it. */
export interface IdTokenContinuityStore {
  put(refreshTokenHash: string, record: IdTokenContinuityRecord, ttlSec: number): Promise<void>;
  /** Reads and removes the record, so a rotated refresh token can never renew twice. */
  take(refreshTokenHash: string): Promise<IdTokenContinuityRecord | null>;
}

export type LiveIdentitySession = IdentitySessionClaimSource & { subjectId: string };

export type RefreshedIdTokenDeps = {
  continuity: IdTokenContinuityStore;
  /** The Identity session behind `sid`, only while it is still signed in. */
  findLiveIdentitySession(sid: string): Promise<LiveIdentitySession | null>;
  isSubjectActive(subject: string): Promise<boolean>;
  /** Claims a client receives from Identity's own records (for example staff platforms). */
  accessClaims(input: { subjectId: string; clientId: string }): Promise<Record<string, unknown>>;
  signer: IdentityJwtSigner;
  idTokenTtlSec: number;
  /** How long a refresh token can be used; the record lives as long. */
  continuityTtlSec: number;
};

/**
 * Claims that describe one token rather than the person and their sign-in. They are minted
 * fresh for every renewed token, or (session claims) derived again from the live session.
 */
const PER_TOKEN_CLAIMS = new Set([
  "iss",
  "aud",
  "sub",
  "iat",
  "exp",
  "nbf",
  "jti",
  "nonce",
  "at_hash",
  "c_hash",
  "azp",
  "sid",
  "auth_time",
  "acr",
  "amr",
]);

function identityClaims(payload: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(payload).filter(([name]) => !PER_TOKEN_CLAIMS.has(name)),
  );
}

function singleAudience(aud: unknown): string | null {
  if (typeof aud === "string") return aud;
  if (Array.isArray(aud) && aud.length === 1 && typeof aud[0] === "string") return aud[0];
  return null;
}

/**
 * Renews the ID token when a client refreshes its tokens (OpenID Connect Core 12.2).
 *
 * The token endpoint only rotates the access and refresh tokens. Clients that exchange their ID
 * token for product access would otherwise hold an expired ID token after the first refresh and
 * have to send people back through sign-in every few minutes. A renewed token keeps the subject,
 * client and sign-in (`sid`, `auth_time`) of the original, and is only issued while that sign-in
 * is still live and the account is still active.
 */
export class RefreshedIdTokenService {
  constructor(private readonly deps: RefreshedIdTokenDeps) {}

  /** Records an authorization-code response so its refresh token can renew the ID token later. */
  async rememberIssued(input: { refreshToken: string; idToken: string }): Promise<void> {
    const payload = decodeJwt(input.idToken) as Record<string, unknown>;
    const clientId = singleAudience(payload.aud);
    if (
      typeof payload.iss !== "string" ||
      typeof payload.sid !== "string" ||
      typeof payload.sub !== "string" ||
      !clientId
    ) {
      return;
    }
    await this.deps.continuity.put(
      hashRefreshToken(input.refreshToken),
      {
        issuer: payload.iss,
        sid: payload.sid,
        subject: payload.sub,
        clientId,
        claims: identityClaims(payload),
      },
      this.deps.continuityTtlSec,
    );
  }

  /**
   * Returns a renewed ID token for a refresh that rotated `previousRefreshToken` into
   * `nextRefreshToken`, or null when the sign-in behind it has ended or is unknown.
   */
  async renew(input: {
    previousRefreshToken: string;
    nextRefreshToken: string;
  }): Promise<string | null> {
    const record = await this.deps.continuity.take(hashRefreshToken(input.previousRefreshToken));
    if (!record) return null;

    const session = await this.deps.findLiveIdentitySession(record.sid);
    if (!session || session.subjectId !== record.subject) return null;
    if (!(await this.deps.isSubjectActive(record.subject))) return null;

    const access = await this.deps.accessClaims({
      subjectId: record.subject,
      clientId: record.clientId,
    });
    const { token } = await this.deps.signer.sign({
      typ: "JWT",
      issuer: record.issuer,
      audience: record.clientId,
      subject: record.subject,
      expirationTime: `${this.deps.idTokenTtlSec}s`,
      claims: { ...record.claims, ...identityClaims(access), ...oidcSessionClaims(session) },
    });
    await this.deps.continuity.put(
      hashRefreshToken(input.nextRefreshToken),
      record,
      this.deps.continuityTtlSec,
    );
    return token;
  }
}
