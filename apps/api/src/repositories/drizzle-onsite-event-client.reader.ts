import type { Database } from "@auction/db";
import { user } from "@auction/db/schema";
import { sql } from "drizzle-orm";
import type {
  IOnsiteEventClientReader,
  OnsiteEventClientRow,
} from "./interfaces/onsite-event-client.reader.js";

export class DrizzleOnsiteEventClientReader implements IOnsiteEventClientReader {
  constructor(private readonly db: Database) {}

  async findByEmail(email: string): Promise<OnsiteEventClientRow | null> {
    const norm = email.trim().toLowerCase();
    const [row] = await this.db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        suspendedAt: user.suspendedAt,
      })
      .from(user)
      .where(sql`lower(${user.email}) = ${norm}`)
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
