import type { IdentityDatabase } from "@auction/identity-db";
import { oauthAccessToken } from "@auction/identity-db/schema";
import { and, eq, inArray, or } from "drizzle-orm";
import type { OAuthTokenSignInStore } from "../services/oauth-token-sign-in-binding.service.js";
import { hashRefreshToken } from "../services/refresh-token-family.ports.js";

type TokenDatabase = Pick<IdentityDatabase, "delete" | "update">;

function holdsRefreshToken(rawToken: string) {
  return or(
    eq(oauthAccessToken.refreshTokenHash, hashRefreshToken(rawToken)),
    eq(oauthAccessToken.refreshToken, `h1:${hashRefreshToken(rawToken)}`),
    eq(oauthAccessToken.refreshToken, rawToken),
  );
}

/**
 * Deletes a person's OAuth tokens issued under the given sign-in ids, and no other token of theirs.
 * `names` is a record's id with its earlier ids.
 */
export async function deleteTokensIssuedUnder(
  db: Pick<TokenDatabase, "delete">,
  subjectId: string,
  names: readonly string[],
): Promise<number> {
  if (names.length === 0) return 0;
  const deleted = await db
    .delete(oauthAccessToken)
    .where(and(eq(oauthAccessToken.userId, subjectId), inArray(oauthAccessToken.sid, [...names])))
    .returning({ id: oauthAccessToken.id });
  return deleted.length;
}

export class DrizzleOAuthTokenSignInStore implements OAuthTokenSignInStore {
  constructor(private readonly db: IdentityDatabase) {}

  async bindRefreshToken(refreshToken: string, sid: string): Promise<boolean> {
    const rows = await this.db
      .update(oauthAccessToken)
      .set({ sid })
      .where(holdsRefreshToken(refreshToken))
      .returning({ id: oauthAccessToken.id });
    return rows.length > 0;
  }

  async discardRefreshToken(refreshToken: string): Promise<void> {
    await this.db.delete(oauthAccessToken).where(holdsRefreshToken(refreshToken));
  }
}
