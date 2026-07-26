import type { Database } from "@auction/db";
import { account } from "@auction/db/schema";
import { and, eq } from "drizzle-orm";
import type {
  IAuthOAuthAccountReader,
  OAuthMarketingProvider,
} from "../services/interfaces/auth-oauth-account-reader.js";

export class DrizzleAuthOAuthAccountReader implements IAuthOAuthAccountReader {
  constructor(private readonly authDb: Database) {}

  async hasLinkedProvider(userId: string, provider: OAuthMarketingProvider): Promise<boolean> {
    const [linked] = await this.authDb
      .select({ providerId: account.providerId })
      .from(account)
      .where(and(eq(account.userId, userId), eq(account.providerId, provider)))
      .limit(1);
    return linked != null;
  }
}
