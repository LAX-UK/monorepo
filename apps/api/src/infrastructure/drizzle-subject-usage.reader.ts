import type { Database } from "@auction/db";
import { bidUserProfile, externalAccount } from "@auction/db/schema";
import { sql } from "drizzle-orm";
import type { ISubjectUsageReader } from "../services/interfaces/subject-usage-reader.js";

export class DrizzleSubjectUsageReader implements ISubjectUsageReader {
  constructor(private readonly db: Database) {}

  async getSubjectUsage(subjectId: string) {
    const result = await this.db.execute<{
      hasProductProfile: boolean;
      hasExternalLink: boolean;
    }>(sql`
      select
        exists(
          select 1
          from ${bidUserProfile}
          where ${bidUserProfile.userId} = ${subjectId}
        ) as "hasProductProfile",
        exists(
          select 1
          from ${externalAccount}
          where ${externalAccount.userId} = ${subjectId}
        ) as "hasExternalLink"
    `);
    const usage = result.rows[0];
    return {
      hasProductProfile: usage?.hasProductProfile ?? false,
      hasExternalLink: usage?.hasExternalLink ?? false,
    };
  }
}
