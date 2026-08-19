import type { IdentityDatabase } from "@auction/identity-db";
import { oauthAccessToken } from "@auction/identity-db/schema";
import { and, eq, inArray, or } from "drizzle-orm";
import type {
  OauthTokenLookup,
  OauthTokenStore,
} from "../services/oauth-token-management.ports.js";

export class DrizzleOauthTokenStore implements OauthTokenStore {
  constructor(private readonly db: IdentityDatabase) {}

  async findByClientAndToken(input: OauthTokenLookup) {
    const tokenConditions = [
      ...(input.accessTokenCandidates.length > 0
        ? [inArray(oauthAccessToken.accessToken, [...input.accessTokenCandidates])]
        : []),
      ...(input.refreshTokenCandidates.length > 0
        ? [inArray(oauthAccessToken.refreshToken, [...input.refreshTokenCandidates])]
        : []),
    ];
    const tokenCondition = or(...tokenConditions);
    if (!tokenCondition) return null;

    const [row] = await this.db
      .select({
        id: oauthAccessToken.id,
        clientId: oauthAccessToken.clientId,
        userId: oauthAccessToken.userId,
        scopes: oauthAccessToken.scopes,
        accessToken: oauthAccessToken.accessToken,
        refreshToken: oauthAccessToken.refreshToken,
        accessTokenExpiresAt: oauthAccessToken.accessTokenExpiresAt,
        refreshTokenExpiresAt: oauthAccessToken.refreshTokenExpiresAt,
        refreshFamilyId: oauthAccessToken.refreshFamilyId,
        refreshConsumedAt: oauthAccessToken.refreshConsumedAt,
        createdAt: oauthAccessToken.createdAt,
      })
      .from(oauthAccessToken)
      .where(and(eq(oauthAccessToken.clientId, input.requesterClientId), tokenCondition))
      .limit(1);
    return row ?? null;
  }

  async deleteToken(tokenId: string): Promise<void> {
    await this.db.delete(oauthAccessToken).where(eq(oauthAccessToken.id, tokenId));
  }

  async deleteRefreshFamily(refreshFamilyId: string): Promise<void> {
    await this.db
      .delete(oauthAccessToken)
      .where(eq(oauthAccessToken.refreshFamilyId, refreshFamilyId));
  }
}
