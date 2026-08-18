import type { Database } from "@auction/db";
import { writeBidUserProfile } from "@auction/persistence/bid-user-profile-sync";
import type { SignupPersona } from "@auction/validators";
import type { IUserProfilePersister } from "../services/interfaces/registration.js";

export class DrizzleUserProfilePersister implements IUserProfilePersister {
  constructor(private readonly db: Database) {}

  async setRegistrationProfile(input: {
    userId: string;
    firstName: string;
    lastName: string;
    persona: SignupPersona;
    mobile?: string;
    mobileCountry?: string;
  }): Promise<{ ok: true } | { ok: false; message: string }> {
    try {
      await writeBidUserProfile(this.db, input.userId, {
        firstName: input.firstName,
        lastName: input.lastName,
        mobile: input.mobile ?? null,
        mobileCountry: input.mobileCountry ?? null,
        signupPersona: input.persona,
      });
      return { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Profile update failed";
      return { ok: false, message: msg };
    }
  }
}
