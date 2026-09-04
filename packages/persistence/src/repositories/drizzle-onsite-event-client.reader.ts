import type { Database } from "@auction/db";
import { bidIdentityDirectory, bidUserProfile } from "@auction/db/schema";
import { and, eq } from "drizzle-orm";
import type {
  IOnsiteEventClientReader,
  OnsiteEventClientRow,
} from "../interfaces/onsite-event-client.reader.js";
import {
  activeIdentitySubject,
  normalizedIdentityEmailEquals,
} from "../lib/bid-identity-directory-query.js";

export class DrizzleOnsiteEventClientReader implements IOnsiteEventClientReader {
  constructor(private readonly db: Database) {}

  async findByEmail(email: string): Promise<OnsiteEventClientRow | null> {
    const [row] = await this.db
      .select({
        id: bidIdentityDirectory.subjectId,
        email: bidIdentityDirectory.email,
        name: bidIdentityDirectory.name,
        suspendedAt: bidUserProfile.suspendedAt,
      })
      .from(bidIdentityDirectory)
      .innerJoin(bidUserProfile, eq(bidUserProfile.userId, bidIdentityDirectory.subjectId))
      .where(
        and(
          normalizedIdentityEmailEquals(bidIdentityDirectory.email, email),
          activeIdentitySubject(),
        ),
      )
      .limit(1);

    if (!row) return null;

    return {
      id: row.id,
      email: row.email,
      name: row.name,
      suspended: row.suspendedAt != null,
    };
  }
}
