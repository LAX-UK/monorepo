import type {
  LaxStaffAccessGrantedPayloadV1,
  LaxStaffAccessRevokedPayloadV1,
  StaffRoleAssignedPayloadV1,
  StaffRoleAssignment,
  StaffRoleRemovedPayloadV1,
  StaffRoles,
  UserRole,
  UserStaffRole,
} from "@auction/types";

/** One stored assignment: the role and its period, plus who granted it, when and why. */
export type StaffRoleAssignmentRecord = StaffRoleAssignment & {
  readonly id: string;
  readonly userId: string;
  readonly grantedByUserId: string | null;
  readonly grantedAt: Date;
  readonly reason: string | null;
};

export type NewStaffRoleAssignment = {
  readonly userId: string;
  readonly role: UserStaffRole;
  readonly startsAt: Date;
  readonly endsAt: Date | null;
  readonly grantedByUserId: string;
  readonly reason: string | null;
};

/** The audit trail of a roster change, written in the same transaction as the change. */
export type StaffRosterEvent =
  | {
      readonly type: "staff.role_assigned";
      readonly userId: string;
      readonly actorUserId: string;
      readonly payload: StaffRoleAssignedPayloadV1;
    }
  | {
      readonly type: "staff.role_removed";
      readonly userId: string;
      readonly actorUserId: string;
      readonly payload: StaffRoleRemovedPayloadV1;
    }
  | { readonly type: "lax.staff_access.granted"; readonly payload: LaxStaffAccessGrantedPayloadV1 }
  | { readonly type: "lax.staff_access.revoked"; readonly payload: LaxStaffAccessRevokedPayloadV1 };

/** The platform role on the Bid profile and the single staff role screens show for it. */
export type StaffProfileRoles = {
  readonly role: UserRole;
  readonly primaryStaffRole: UserStaffRole | null;
};

/** Read side: the assignments a person holds, for sessions and staff screens. */
export interface IStaffRoleAssignmentReader {
  /** Assignments not ended at `now`: in force, or starting later. */
  listCurrent(userId: string, now: Date): Promise<StaffRoleAssignmentRecord[]>;
  /** The roles in force at `now`, each once. */
  listActiveRoles(userId: string, now: Date): Promise<StaffRoles>;
}

/**
 * One roster change. Everything here commits together, and changes to the roster are serialised,
 * so two people changing roles at once cannot both pass the last-administrator rule.
 */
export interface IStaffRosterTransaction {
  /** The person's assignments not ended at `now`, locked for this change. */
  listCurrent(userId: string, now: Date): Promise<StaffRoleAssignmentRecord[]>;
  /** People other than `userId` who are active staff and hold the administrator role at `now`. */
  countOtherActiveAdministrators(userId: string, now: Date): Promise<number>;
  insert(assignment: NewStaffRoleAssignment): Promise<StaffRoleAssignmentRecord>;
  /** Ends an assignment at `endsAt`; the row stays as history. */
  end(assignmentId: string, endsAt: Date): Promise<void>;
  /** Writes the profile's roles and returns what they were (null when there was no profile). */
  writeProfileRoles(userId: string, next: StaffProfileRoles): Promise<StaffProfileRoles | null>;
  recordEvents(events: readonly StaffRosterEvent[]): Promise<void>;
}

export interface IStaffRoster extends IStaffRoleAssignmentReader {
  transact<T>(work: (tx: IStaffRosterTransaction) => Promise<T>): Promise<T>;
}
