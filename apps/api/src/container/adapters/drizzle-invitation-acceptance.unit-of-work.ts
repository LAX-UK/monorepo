import type { Database } from "@auction/db";
import {
  DrizzleStaffRoster,
  DrizzleUserInvitationRepository,
} from "@auction/persistence/repositories";
import type {
  IInvitationAcceptanceUnitOfWork,
  InvitationAcceptanceScope,
} from "../../services/invitation-consumption.service.js";
import { StaffRoleAssignmentService } from "../../services/staff/staff-role-assignment.service.js";

/**
 * One transaction for accepting an invitation: the invitation repository and the staff roster
 * are bound to it, so a refused role change leaves the invitation pending.
 */
export class DrizzleInvitationAcceptanceUnitOfWork implements IInvitationAcceptanceUnitOfWork {
  constructor(
    private readonly db: Database,
    private readonly producer = "apps/api",
  ) {}

  run<T>(work: (scope: InvitationAcceptanceScope) => Promise<T>): Promise<T> {
    return this.db.transaction((tx) =>
      work({
        invitations: new DrizzleUserInvitationRepository(tx, this.producer),
        staffAccess: new StaffRoleAssignmentService(new DrizzleStaffRoster(tx, this.producer)),
      }),
    );
  }
}
