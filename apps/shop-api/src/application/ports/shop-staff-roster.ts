import type { ShopStaffRole } from "@auction/shop-domain";
import type { StaffRoleAssignment } from "@auction/types";

/** One LAX Admin role a person holds for a period, with who gave it, when and why. */
export type ShopStaffRoleAssignmentRecord = StaffRoleAssignment<ShopStaffRole> & {
  readonly id: string;
  readonly subjectId: string;
  readonly grantedBySubjectId: string | null;
  readonly grantedAt: Date;
  readonly reason: string | null;
  readonly endRecordedAt: Date | null;
};

export type NewShopStaffRoleAssignment = {
  readonly subjectId: string;
  readonly role: ShopStaffRole;
  readonly startsAt: Date;
  readonly endsAt: Date | null;
  readonly grantedBySubjectId: string;
  readonly reason: string | null;
  /** The Bid event that asked for the role; null for the ops CLI and seeds. */
  readonly grantedEventId: number | null;
};

/** What the roster audit log records for one change. */
export type ShopStaffRosterAuditEntry = {
  readonly actorSubjectId: string;
  readonly action: "staff_role_assign" | "staff_role_remove" | "staff_role_expire";
  readonly assignmentId: string;
  readonly before: Record<string, unknown> | null;
  readonly after: Record<string, unknown>;
};

/**
 * One roster change. Everything here commits together, and changes to the roster are serialised,
 * so two changes at once cannot both pass the last-Administrator rule.
 */
export interface ShopStaffRosterTransaction {
  /** The person's assignments not ended at `now`: in force, or starting later. */
  listCurrent(subjectId: string, now: Date): Promise<ShopStaffRoleAssignmentRecord[]>;
  /** People other than `subjectId` holding the Administrator role at `now`. */
  countOtherActiveAdministrators(subjectId: string, now: Date): Promise<number>;
  findById(assignmentId: string): Promise<ShopStaffRoleAssignmentRecord | null>;
  /** Makes sure the person has a staff record, so an assignment can belong to it. */
  ensureMember(subjectId: string, role: ShopStaffRole): Promise<void>;
  insert(assignment: NewShopStaffRoleAssignment): Promise<ShopStaffRoleAssignmentRecord>;
  /** Ends an assignment at `endsAt` and records the end; the row stays as history. */
  end(assignmentId: string, endsAt: Date, endedEventId: number | null): Promise<void>;
  /** Records the end of an assignment whose end date has passed. Already recorded: untouched. */
  recordEnd(assignmentId: string, at: Date, endedEventId: number | null): Promise<void>;
  /**
   * Keeps the staff record in step with the roles in force: the primary one for display, and the
   * record disabled when none is left.
   */
  writeMember(subjectId: string, primaryRole: ShopStaffRole | null, now: Date): Promise<void>;
  audit(entry: ShopStaffRosterAuditEntry): Promise<void>;
}

export interface ShopStaffRoster {
  transact<T>(work: (tx: ShopStaffRosterTransaction) => Promise<T>): Promise<T>;
}
