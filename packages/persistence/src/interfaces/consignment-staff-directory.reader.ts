import type { StaffRoles } from "@auction/types";

export type ActiveStaffMember = { userId: string; name: string; roles: StaffRoles };

/** Active, unsuspended staff and the Bid staff roles each holds right now. */
export interface IConsignmentStaffDirectory {
  listActiveStaff(now: Date): Promise<ActiveStaffMember[]>;
  /** `null` when the person is not active staff. */
  findActiveStaff(userId: string, now: Date): Promise<ActiveStaffMember | null>;
}
