import type { Database } from "@auction/db";
import { user } from "@auction/db/schema";
import { and, eq, isNotNull } from "drizzle-orm";
import type { IUserSuspensionChecker } from "../services/interfaces/user-suspension.js";

export class DrizzleUserSuspensionChecker implements IUserSuspensionChecker {
  constructor(private readonly db: Database) {}

  async isSuspended(userId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.id, userId), isNotNull(user.suspendedAt)))
      .limit(1);
    return Boolean(row);
  }
}
