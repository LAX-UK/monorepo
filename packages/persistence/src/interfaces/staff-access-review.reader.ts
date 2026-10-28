import type { StaffRoleAssignmentRecord } from "./staff-role-assignment.repository.js";

/** One staff member as the access review lists them, with the roles they hold or will hold. */
export type StaffAccessReviewPerson = {
  readonly userId: string;
  readonly name: string | null;
  readonly email: string;
  readonly suspended: boolean;
  /** Assignments not ended at the time asked: in force, or starting later. */
  readonly assignments: readonly StaffRoleAssignmentRecord[];
};

export interface IStaffAccessReviewReader {
  /** Every Bid staff member, with their assignments not ended at `now`. */
  listStaff(now: Date): Promise<StaffAccessReviewPerson[]>;
}
