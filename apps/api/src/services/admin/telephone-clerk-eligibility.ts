import type { IUserRepository } from "@auction/persistence/interfaces";
import {
  SALEROOM_ACCESS,
  normalizeUserRole,
  normalizeUserStaffRole,
  userHasAccessTo,
} from "@auction/types";

/** Decides whether a user may be given a telephone line to take in the saleroom. */
export interface ITelephoneClerkEligibility {
  canTakeTelephoneLines(userId: string): Promise<boolean>;
}

/**
 * A clerk is anyone who can run the saleroom (the same rule the admin UI uses to offer people in
 * the picker), so a crafted request cannot hand a line to someone without that access.
 */
export class SaleroomAccessClerkEligibility implements ITelephoneClerkEligibility {
  constructor(private readonly users: Pick<IUserRepository, "findById">) {}

  async canTakeTelephoneLines(userId: string): Promise<boolean> {
    const user = await this.users.findById(userId);
    if (!user) return false;
    const role = normalizeUserRole(user.role);
    if (!role) return false;
    const staffRole = user.staffRole ? normalizeUserStaffRole(user.staffRole) : null;
    return userHasAccessTo(role, staffRole, SALEROOM_ACCESS);
  }
}
