import type {
  IAdminUserReader,
  ILaxAdminRoleReader,
  IStaffAccessReviewReader,
  IStaffRoleAssignmentReader,
  IStaffRosterFactsReader,
  StaffRoleAssignmentRecord,
} from "@auction/persistence/interfaces";
import {
  type LaxShopStaffRole,
  type StaffRoleAssignmentRefusal,
  type UserStaffRole,
  staffRoleRefusalMessage,
} from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import type { IIdentityTwoFactorPolicyClient } from "../interfaces/identity-issuer-client.js";
import {
  type AssignStaffRoleInput,
  type RemoveStaffRoleInput,
  StaffRoleAssignmentRefused,
} from "./staff-role-assignment.service.js";

/** One role a person holds or will hold, as the staff screens show it. */
export type StaffRoleView = {
  id: string;
  role: UserStaffRole;
  startsAt: string;
  endsAt: string | null;
  grantedAt: string;
  reason: string | null;
};

/** A person's roles and the roster fact the screens need before a removal. */
export type StaffRolesOverview = {
  userId: string;
  assignments: StaffRoleView[];
  /** Other active administrators; zero means this person's administrator role cannot go. */
  otherActiveAdministrators: number;
};

/** One LAX Admin role as the access review lists it. */
export type LaxAdminRoleReviewView = Omit<StaffRoleView, "role"> & { role: LaxShopStaffRole };

export type StaffAccessReviewRow = {
  userId: string;
  name: string | null;
  email: string;
  suspended: boolean;
  lastSignInAt: string | null;
  /** Bid admin roles held or starting later. */
  roles: StaffRoleView[];
  /** LAX Admin roles held or starting later. */
  laxAdminRoles: LaxAdminRoleReviewView[];
};

export type StaffRolesError = {
  status: 404 | 409;
  message: string;
  /** The role rule that refused the change, for the screens to explain. */
  code?: StaffRoleAssignmentRefusal;
};

/** ISP: the two roster changes the staff record makes. */
export interface IStaffRoleChanges {
  assign(input: AssignStaffRoleInput): Promise<void>;
  remove(input: RemoveStaffRoleInput): Promise<void>;
}

/** Identity reads sign-ins in batches of this size. */
const SIGN_IN_BATCH = 100;

const notStaff: StaffRolesError = { status: 404, message: "Staff member not found" };

type Period = {
  id: string;
  startsAt: Date;
  endsAt: Date | null;
  grantedAt: Date;
  reason: string | null;
};

/** A held role's period as screens show it, for either admin. */
function periodView(assignment: Period): Omit<StaffRoleView, "role"> {
  return {
    id: assignment.id,
    startsAt: assignment.startsAt.toISOString(),
    endsAt: assignment.endsAt?.toISOString() ?? null,
    grantedAt: assignment.grantedAt.toISOString(),
    reason: assignment.reason,
  };
}

function toView(assignment: StaffRoleAssignmentRecord): StaffRoleView {
  return { ...periodView(assignment), role: assignment.role };
}

function chunks<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * The staff record's roles and the access review: reads a person's roles with the facts a
 * change depends on, makes role changes through the roster (whose rules refuse what may not
 * happen), and lists every staff member's roles with their last sign-in. Who may call each is
 * decided by the route's capability guard.
 */
export class StaffRolesAdminService {
  constructor(
    private readonly deps: {
      changes: IStaffRoleChanges;
      roles: IStaffRoleAssignmentReader & IStaffRosterFactsReader;
      users: Pick<IAdminUserReader, "getById" | "getByIds">;
      review: IStaffAccessReviewReader;
      laxAdminRoles: Pick<ILaxAdminRoleReader, "listAllCurrent">;
      identity: Pick<IIdentityTwoFactorPolicyClient, "readSecuritySummaries">;
      clock?: () => Date;
    },
  ) {}

  private now(): Date {
    return this.deps.clock?.() ?? new Date();
  }

  private async isStaff(userId: string): Promise<boolean> {
    const user = await this.deps.users.getById(userId);
    return user?.role === "staff";
  }

  async overview(userId: string): Promise<Result<StaffRolesOverview, StaffRolesError>> {
    if (!(await this.isStaff(userId))) return err(notStaff);
    const now = this.now();
    const [assignments, otherActiveAdministrators] = await Promise.all([
      this.deps.roles.listCurrent(userId, now),
      this.deps.roles.countOtherActiveAdministrators(userId, now),
    ]);
    return ok({ userId, assignments: assignments.map(toView), otherActiveAdministrators });
  }

  assign(input: AssignStaffRoleInput): Promise<Result<void, StaffRolesError>> {
    return this.change(input.userId, () => this.deps.changes.assign(input));
  }

  remove(input: RemoveStaffRoleInput): Promise<Result<void, StaffRolesError>> {
    return this.change(input.userId, () => this.deps.changes.remove(input));
  }

  private async change(
    userId: string,
    run: () => Promise<void>,
  ): Promise<Result<void, StaffRolesError>> {
    if (!(await this.isStaff(userId))) return err(notStaff);
    try {
      await run();
      return ok(undefined);
    } catch (error) {
      if (!(error instanceof StaffRoleAssignmentRefused)) throw error;
      return err({
        status: 409,
        code: error.reason,
        message: staffRoleRefusalMessage({
          reason: error.reason,
          role: error.role,
          conflictingRole: error.conflictingRole,
        }),
      });
    }
  }

  /**
   * Every staff member of either admin with the roles they hold or will hold there, and when they
   * last signed in. Someone with LAX Admin roles only is listed too.
   */
  async accessReview(): Promise<StaffAccessReviewRow[]> {
    const now = this.now();
    const [bidStaff, laxAssignments] = await Promise.all([
      this.deps.review.listStaff(now),
      this.deps.laxAdminRoles.listAllCurrent(now),
    ]);
    const laxBySubject = new Map<string, LaxAdminRoleReviewView[]>();
    for (const assignment of laxAssignments) {
      const views = laxBySubject.get(assignment.subjectId) ?? [];
      views.push({ ...periodView(assignment), role: assignment.role });
      laxBySubject.set(assignment.subjectId, views);
    }
    const bidIds = new Set(bidStaff.map((person) => person.userId));
    const laxOnlyIds = [...laxBySubject.keys()].filter((id) => !bidIds.has(id));
    const laxOnly = laxOnlyIds.length > 0 ? await this.deps.users.getByIds(laxOnlyIds) : [];
    const people = [
      ...bidStaff,
      ...laxOnly.map((user) => ({
        userId: user.id,
        name: user.name || null,
        email: user.email,
        suspended: user.suspendedAt !== null,
        assignments: [],
      })),
    ];
    const signIns = new Map<string, Date | null>();
    for (const batch of chunks(
      people.map((person) => person.userId),
      SIGN_IN_BATCH,
    )) {
      // A sign-in the identity service cannot give is shown as unknown, not as a failure.
      const summaries = await this.deps.identity.readSecuritySummaries(batch).catch(() => null);
      for (const id of batch) signIns.set(id, summaries?.get(id)?.lastSignInAt ?? null);
    }
    return people.map((person) => ({
      userId: person.userId,
      name: person.name,
      email: person.email,
      suspended: person.suspended,
      lastSignInAt: signIns.get(person.userId)?.toISOString() ?? null,
      roles: person.assignments.map(toView),
      laxAdminRoles: laxBySubject.get(person.userId) ?? [],
    }));
  }
}
