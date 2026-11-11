import { createHash } from "node:crypto";

export type RefreshTokenFamilyRecord = {
  tokenId: string;
  userId: string | null;
  familyId: string;
  expiresAt: Date;
  /** The sign-in the token was issued under (the ID token's `sid`); null for tokens issued before it was recorded. */
  sid: string | null;
};

export interface IRefreshTokenFamilyRepository {
  findAndPrepare(rawToken: string): Promise<RefreshTokenFamilyRecord | null>;
  completeRotation(input: {
    consumedTokenId: string;
    newRawToken: string;
    familyId: string;
  }): Promise<void>;
  revokeFamily(familyId: string, userId: string | null): Promise<void>;
  /** Deletes the family's tokens only: the person's sign-in records and other tokens stay. */
  deleteFamilyTokens(familyId: string): Promise<void>;
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

/**
 * Whether the sign-in behind a refresh token is still live. A refresh is refused once the record
 * behind its `sid` (or an earlier id of that record) has ended or expired, so a product asks the
 * person to sign in again instead of holding tokens that outlast the sign-in they came from.
 */
export interface RefreshSignInGuard {
  isLive(input: {
    userId: string | null;
    sid: string | null;
    refreshToken: string;
  }): Promise<boolean>;
}
