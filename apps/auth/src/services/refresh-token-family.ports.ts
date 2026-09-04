import { createHash } from "node:crypto";

export type RefreshTokenFamilyRecord = {
  tokenId: string;
  userId: string | null;
  familyId: string;
  expiresAt: Date;
};

export interface IRefreshTokenFamilyRepository {
  findAndPrepare(rawToken: string): Promise<RefreshTokenFamilyRecord | null>;
  completeRotation(input: {
    consumedTokenId: string;
    newRawToken: string;
    familyId: string;
  }): Promise<void>;
  revokeFamily(familyId: string, userId: string | null): Promise<void>;
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}
