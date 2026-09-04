import type { IdentityDatabase } from "@auction/identity-db";
import { oauthAccessToken, session } from "@auction/identity-db/schema";
import { eq, or } from "drizzle-orm";
import type { BackchannelLogoutService } from "../services/backchannel-logout.service.js";
import {
  type IRefreshTokenFamilyRepository,
  type RefreshTokenFamilyRecord,
  hashRefreshToken,
} from "../services/refresh-token-family.ports.js";

function storedTokenFingerprint(token: string): string {
  return `h1:${hashRefreshToken(token)}`;
}

/** Bridges Better Auth's token rows to explicit rotation-family state. */
export class DrizzleRefreshTokenFamilyRepository implements IRefreshTokenFamilyRepository {
  constructor(
    private readonly db: IdentityDatabase,
    private readonly logout?: Pick<BackchannelLogoutService, "revokeSubject">,
  ) {}

  async findAndPrepare(rawToken: string): Promise<RefreshTokenFamilyRecord | null> {
    const [row] = await this.db
      .select({
        id: oauthAccessToken.id,
        userId: oauthAccessToken.userId,
        familyId: oauthAccessToken.refreshFamilyId,
        expiresAt: oauthAccessToken.refreshTokenExpiresAt,
      })
      .from(oauthAccessToken)
      .where(
        or(
          eq(oauthAccessToken.refreshTokenHash, hashRefreshToken(rawToken)),
          eq(oauthAccessToken.refreshToken, storedTokenFingerprint(rawToken)),
          eq(oauthAccessToken.refreshToken, rawToken),
        ),
      )
      .limit(1);
    if (!row) return null;

    const familyId = row.familyId ?? row.id;
    await this.db
      .update(oauthAccessToken)
      .set({
        refreshFamilyId: familyId,
        refreshTokenHash: hashRefreshToken(rawToken),
      })
      .where(eq(oauthAccessToken.id, row.id));

    return {
      tokenId: row.id,
      userId: row.userId,
      familyId,
      expiresAt: row.expiresAt,
    };
  }

  async completeRotation(input: {
    consumedTokenId: string;
    newRawToken: string;
    familyId: string;
  }): Promise<void> {
    try {
      await this.db.transaction(async (tx) => {
        const [successor] = await tx
          .update(oauthAccessToken)
          .set({
            refreshFamilyId: input.familyId,
            refreshTokenHash: hashRefreshToken(input.newRawToken),
          })
          .where(
            or(
              eq(oauthAccessToken.refreshToken, storedTokenFingerprint(input.newRawToken)),
              eq(oauthAccessToken.refreshToken, input.newRawToken),
            ),
          )
          .returning({ id: oauthAccessToken.id });
        if (!successor) throw new Error("OIDC refresh successor row was not persisted");

        const [predecessor] = await tx
          .update(oauthAccessToken)
          .set({ refreshConsumedAt: new Date() })
          .where(eq(oauthAccessToken.id, input.consumedTokenId))
          .returning({ id: oauthAccessToken.id });
        if (!predecessor) throw new Error("OIDC refresh predecessor row was not found");
      });
    } catch (error) {
      // Better Auth inserts the successor before middleware regains control.
      // Do not leave an undisclosed, untracked refresh token valid after a 500.
      await this.db
        .delete(oauthAccessToken)
        .where(
          or(
            eq(oauthAccessToken.refreshToken, storedTokenFingerprint(input.newRawToken)),
            eq(oauthAccessToken.refreshToken, input.newRawToken),
          ),
        );
      throw error;
    }
  }

  async revokeFamily(familyId: string, userId: string | null): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.delete(oauthAccessToken).where(eq(oauthAccessToken.refreshFamilyId, familyId));
      if (userId) {
        await tx.delete(session).where(eq(session.userId, userId));
      }
    });
    if (userId) await this.logout?.revokeSubject(userId);
  }
}
