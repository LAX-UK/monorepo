import type { Database } from "@auction/db";
import { user } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type { IRegistrationCompensator } from "../services/interfaces/registration.js";

/** Deletes an orphaned auth user via the `auth_app` connection (account/session rows cascade). */
export class DrizzleRegistrationCompensator implements IRegistrationCompensator {
  constructor(private readonly authDb: Database) {}

  async deleteOrphanedUser(userId: string): Promise<{ ok: boolean }> {
    try {
      await this.authDb.delete(user).where(eq(user.id, userId));
      return { ok: true };
    } catch (err) {
      console.error("[registration] compensating user delete failed", {
        userId,
        error: err instanceof Error ? err.message : String(err),
      });
      return { ok: false };
    }
  }
}
