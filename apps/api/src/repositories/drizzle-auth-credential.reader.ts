import type { Database } from "@auction/db";
import { account } from "@auction/db/schema";
import { and, eq } from "drizzle-orm";
import type { IAuthCredentialReader } from "./interfaces/auth-credential.reader.js";

export class DrizzleAuthCredentialReader implements IAuthCredentialReader {
  constructor(private readonly authDb: Database) {}

  async hasCredentialAccount(userId: string): Promise<boolean> {
    const [row] = await this.authDb
      .select({ id: account.id })
      .from(account)
      .where(and(eq(account.userId, userId), eq(account.providerId, "credential")))
      .limit(1);
    return Boolean(row);
  }
}
