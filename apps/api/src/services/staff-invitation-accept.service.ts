import type { IUserRepository } from "@auction/persistence/interfaces";
import type { LaxStaffGrant } from "@auction/types";
import { type Result, err } from "neverthrow";
import type { IInvitationConsumption } from "./invitation-consumption.service.js";
import { type InvitationError, invitationWelcomePath } from "./invitation.service.js";

export type StaffInvitationAccepted = { grants: LaxStaffGrant[]; welcomePath: string };

/** Signed-in account accepting a LAX staff invitation sent to its own email address. */
export class StaffInvitationAcceptService {
  constructor(
    private readonly users: Pick<IUserRepository, "findById">,
    private readonly consumption: Pick<IInvitationConsumption, "acceptForExistingUser">,
  ) {}

  async accept(
    userId: string,
    token: string,
  ): Promise<Result<StaffInvitationAccepted, InvitationError>> {
    const user = await this.users.findById(userId);
    if (!user?.email) return err({ message: "user_not_found", status: 404 });
    const accepted = await this.consumption.acceptForExistingUser(token, userId, user.email);
    return accepted.map(({ grants }) => ({ grants, welcomePath: invitationWelcomePath(grants) }));
  }
}
