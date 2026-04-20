import type { Database } from "@auction/db";
import { user } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type { IUserProfilePersister } from "../services/interfaces/registration.js";

export class DrizzleUserProfilePersister implements IUserProfilePersister {
  constructor(private readonly db: Database) {}

  async setRegistrationProfile(input: {
    userId: string;
    firstName: string;
    lastName: string;
    mobile?: string;
  }): Promise<{ ok: true } | { ok: false; message: string }> {
    try {
      await this.db
        .update(user)
        .set({
          firstName: input.firstName,
          lastName: input.lastName,
          mobile: input.mobile ?? null,
          updatedAt: new Date(),
        })
        .where(eq(user.id, input.userId));
      return { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Profile update failed";
      return { ok: false, message: msg };
    }
  }
}
