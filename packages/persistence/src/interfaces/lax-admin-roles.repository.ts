import type { LaxShopStaffRole, StaffRoleAssignment } from "@auction/types";

/**
 * LAX Admin roles as Bid admin sees them. LAX Admin owns the assignments; Bid reads them from the
 * trigger-maintained directory and asks for changes with `lax.staff_access.*` events, which LAX
 * Admin applies. Bid admin is where staff are managed, so it checks the role rules before asking.
 */

/** One LAX Admin role a person holds or held, as the directory mirrors it. */
export type LaxAdminRoleAssignmentRecord = StaffRoleAssignment<LaxShopStaffRole> & {
  readonly id: string;
  readonly subjectId: string;
  readonly grantedBySubjectId: string | null;
  readonly grantedAt: Date;
  readonly reason: string | null;
  readonly endRecordedAt: Date | null;
  /** The Bid request that gave it, once LAX Admin has applied it. */
  readonly grantedEventId: number | null;
  /** The Bid request that ended it, once LAX Admin has applied it. */
  readonly endedEventId: number | null;
};

/** A change Bid asked LAX Admin to make: one role given, or one taken away. */
export type LaxAdminRoleRequest = {
  readonly eventId: number;
  readonly at: Date;
  readonly subjectId: string;
  readonly kind: "assign" | "remove";
  readonly role: LaxShopStaffRole;
  readonly endsAt: Date | null;
};

export interface ILaxAdminRoleReader {
  /** The person's assignments not ended at `now`: in force, or starting later. */
  listCurrent(subjectId: string, now: Date): Promise<LaxAdminRoleAssignmentRecord[]>;
  /** Everyone's assignments not ended at `now`, for the access review. */
  listAllCurrent(now: Date): Promise<LaxAdminRoleAssignmentRecord[]>;
  /** People other than `subjectId` holding the LAX Admin Administrator role at `now`. */
  countOtherActiveAdministrators(subjectId: string, now: Date): Promise<number>;
  /** People holding the LAX Admin Administrator role at `now`. */
  listActiveAdministratorIds(now: Date): Promise<string[]>;
  /** The person's most recent role requests made since `since`, newest first. */
  listRequestsSince(subjectId: string, since: Date): Promise<LaxAdminRoleRequest[]>;
}

export type NewLaxAdminRoleGrant = {
  readonly subjectId: string;
  readonly role: LaxShopStaffRole;
  readonly endsAt: Date | null;
  readonly reason: string;
  readonly actorSubjectId: string;
};

export type NewLaxAdminRoleRemoval = {
  readonly subjectId: string;
  readonly role: LaxShopStaffRole;
  readonly reason: string;
  readonly actorSubjectId: string;
};

/** Requests to LAX Admin, each written as one `lax.staff_access.*` event. */
export interface ILaxAdminRoleRequestWriter {
  requestGrant(grant: NewLaxAdminRoleGrant): Promise<void>;
  requestRemoval(removal: NewLaxAdminRoleRemoval): Promise<void>;
}

/** A LAX Admin role whose end date passed and whose end Bid asked LAX Admin to record. */
export type LaxAdminRoleEnd = {
  readonly assignmentId: string;
  readonly subjectId: string;
  readonly role: LaxShopStaffRole;
  readonly endedAt: Date;
};

/**
 * The daily expiry of LAX Admin roles, serialised so a run, or two at once, asks for each end only
 * once: the request is written in the same transaction that finds the end still unasked.
 */
export interface ILaxAdminRoleExpiryRequests {
  /** Asks LAX Admin to record up to `limit` ends that passed by `now`; returns what was asked. */
  requestDueEnds(now: Date, limit: number): Promise<LaxAdminRoleEnd[]>;
}
