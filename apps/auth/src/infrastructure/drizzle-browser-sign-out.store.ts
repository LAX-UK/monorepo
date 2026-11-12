import type { IdentityDatabase } from "@auction/identity-db";
import { sessionLineage } from "@auction/identity-db/schema";
import { and, eq } from "drizzle-orm";
import type { BrowserSignOutStore } from "../services/browser-sign-out.service.js";
import { deleteTokensIssuedUnder } from "./drizzle-oauth-token-sign-in.store.js";

export class DrizzleBrowserSignOutStore implements BrowserSignOutStore {
  constructor(private readonly db: IdentityDatabase) {}

  async earlierNames(sessionId: string, subjectId: string): Promise<string[]> {
    const rows = await this.db
      .select({ previousSid: sessionLineage.previousSid })
      .from(sessionLineage)
      .where(and(eq(sessionLineage.sessionId, sessionId), eq(sessionLineage.userId, subjectId)));
    return rows.map((row) => row.previousSid);
  }

  deleteTokensIssuedUnder(subjectId: string, names: readonly string[]): Promise<number> {
    return deleteTokensIssuedUnder(this.db, subjectId, names);
  }
}
