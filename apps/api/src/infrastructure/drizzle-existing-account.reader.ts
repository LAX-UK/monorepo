import type { Database } from "@auction/db";
import { user } from "@auction/db/schema";
import { sql } from "drizzle-orm";
import type { IExistingAccountReader } from "../services/interfaces/registration.js";

export class DrizzleExistingAccountReader implements IExistingAccountReader {
  constructor(private readonly db: Database) {}

  async findByEmail(email: string) {
    const normalized = email.trim().toLowerCase();
    const rows = await this.db
      .select({
        userId: user.id,
        emailVerified: user.emailVerified,
      })
      .from(user)
      .where(sql`lower(${user.email}) = ${normalized}`)
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      userId: row.userId,
      emailVerified: row.emailVerified === true,
    };
  }
}
