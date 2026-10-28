import type {
  IStaffRoster,
  IStaffRosterTransaction,
  StaffRoleAssignmentRecord,
  StaffRosterEvent,
} from "@auction/persistence/interfaces";
import {
  type StaffRoleAssignmentRefusal,
  type UserRole,
  type UserStaffRole,
  checkStaffRoleAssignment,
  isStaffRoleAssignmentCurrent,
  normalizeStaffRoles,
} from "@auction/types";
import { profileRolesFor, staffAccessHistoryEvent } from "./staff-profile-roles.js";

/** A requested role change broke a roster rule; nothing was written. */
export class StaffRoleAssignmentRefused extends Error {
  constructor(
    readonly reason: StaffRoleAssignmentRefusal,
    readonly role: UserStaffRole,
    readonly conflictingRole?: UserStaffRole,
  ) {
    super(`staff_role_assignment_refused:${reason}`);
    this.name = "StaffRoleAssignmentRefused";
  }
}

type Attribution = {
  readonly userId: string;
  readonly actorUserId: string;
  readonly reason: string | null;
};

export type AssignStaffRoleInput = Attribution & {
  readonly role: UserStaffRole;
  /** Defaults to now. */
  readonly startsAt?: Date;
  /** Null or absent: until removed. */
  readonly endsAt?: Date | null;
};

export type RemoveStaffRoleInput = Attribution & { readonly role: UserStaffRole };

/** The person's whole Bid access after the change: platform role and the roles held from now. */
export type SetStaffAccessInput = Attribution & {
  readonly role: UserRole;
  readonly staffRoles: readonly UserStaffRole[];
  /** Set when the change comes from accepting a staff invitation. */
  readonly invitationId?: string | null;
};

/** ISP: what the existing role-change paths (admin role update, invitations) need. */
export interface IStaffAccessWriter {
  setAccess(input: SetStaffAccessInput): Promise<void>;
}

/**
 * One person's roster change inside one transaction: every step is checked against the role
 * rules on the assignments as they stand after the steps before it, then written.
 */
class PersonRosterChange {
  private readonly events: StaffRosterEvent[] = [];

  private constructor(
    private readonly tx: IStaffRosterTransaction,
    private readonly who: Attribution,
    private readonly now: Date,
    private readonly current: StaffRoleAssignmentRecord[],
    private readonly otherActiveAdministrators: number,
  ) {}

  static async open(
    tx: IStaffRosterTransaction,
    who: Attribution,
    now: Date,
  ): Promise<PersonRosterChange> {
    const [current, otherActiveAdministrators] = await Promise.all([
      tx.listCurrent(who.userId, now),
      tx.countOtherActiveAdministrators(who.userId, now),
    ]);
    return new PersonRosterChange(tx, who, now, current, otherActiveAdministrators);
  }

  heldRoles(): UserStaffRole[] {
    return normalizeStaffRoles(
      this.current.filter((a) => isStaffRoleAssignmentCurrent(a, this.now)).map((a) => a.role),
    );
  }

  async assign(role: UserStaffRole, startsAt: Date, endsAt: Date | null): Promise<void> {
    this.check({ kind: "assign", role, startsAt, endsAt }, role);
    const record = await this.tx.insert({
      userId: this.who.userId,
      role,
      startsAt,
      endsAt,
      grantedByUserId: this.who.actorUserId,
      reason: this.who.reason,
    });
    this.current.push(record);
    this.events.push({
      type: "staff.role_assigned",
      userId: this.who.userId,
      actorUserId: this.who.actorUserId,
      payload: {
        assignmentId: record.id,
        role,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt?.toISOString() ?? null,
        reason: this.who.reason,
      },
    });
  }

  async remove(role: UserStaffRole): Promise<void> {
    this.check({ kind: "remove", role }, role);
    const ending = this.current.filter(
      (a) => a.role === role && isStaffRoleAssignmentCurrent(a, this.now),
    );
    for (const assignment of ending) {
      await this.tx.end(assignment.id, this.now);
      this.current.splice(this.current.indexOf(assignment), 1, {
        ...assignment,
        endsAt: this.now,
      });
      this.events.push({
        type: "staff.role_removed",
        userId: this.who.userId,
        actorUserId: this.who.actorUserId,
        payload: { assignmentId: assignment.id, role, reason: this.who.reason },
      });
    }
  }

  /** Writes the profile's roles and the audit trail; the access history notes a changed role. */
  async commit(platformRole: UserRole, invitationId: string | null): Promise<void> {
    const next = profileRolesFor(platformRole, this.current, this.now);
    const previous = await this.tx.writeProfileRoles(this.who.userId, next);
    const accessEvent = staffAccessHistoryEvent(previous, next, {
      userId: this.who.userId,
      actorUserId: this.who.actorUserId,
      invitationId,
    });
    await this.tx.recordEvents(accessEvent ? [...this.events, accessEvent] : this.events);
  }

  private check(change: Parameters<typeof checkStaffRoleAssignment>[1], role: UserStaffRole): void {
    const result = checkStaffRoleAssignment(this.current, change, this.now, {
      otherActiveAdministrators: this.otherActiveAdministrators,
    });
    if (!result.ok)
      throw new StaffRoleAssignmentRefused(result.reason, role, result.conflictingRole);
  }
}

/**
 * Lists, assigns and removes Bid staff roles. Each change is checked against the role rules
 * (no duplicates, no forbidden combinations, never the last administrator), then written with
 * its audit events in one roster transaction.
 */
export class StaffRoleAssignmentService implements IStaffAccessWriter {
  constructor(
    private readonly roster: IStaffRoster,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  /** Assignments not ended yet: in force, or starting later. */
  list(userId: string): Promise<StaffRoleAssignmentRecord[]> {
    return this.roster.listCurrent(userId, this.clock());
  }

  assign(input: AssignStaffRoleInput): Promise<void> {
    return this.roster.transact(async (tx) => {
      const now = this.clock();
      const change = await PersonRosterChange.open(tx, input, now);
      await change.assign(input.role, input.startsAt ?? now, input.endsAt ?? null);
      await change.commit("staff", null);
    });
  }

  remove(input: RemoveStaffRoleInput): Promise<void> {
    return this.roster.transact(async (tx) => {
      const change = await PersonRosterChange.open(tx, input, this.clock());
      await change.remove(input.role);
      await change.commit("staff", null);
    });
  }

  /**
   * Makes the person hold exactly `staffRoles` from now: roles not listed are removed first,
   * then missing ones are assigned. A client holds none.
   */
  setAccess(input: SetStaffAccessInput): Promise<void> {
    return this.roster.transact(async (tx) => {
      const now = this.clock();
      const change = await PersonRosterChange.open(tx, input, now);
      const wanted = input.role === "staff" ? normalizeStaffRoles(input.staffRoles) : [];
      const held = change.heldRoles();
      for (const role of held.filter((r) => !wanted.includes(r))) await change.remove(role);
      for (const role of wanted.filter((r) => !held.includes(r))) {
        await change.assign(role, now, null);
      }
      await change.commit(input.role, input.invitationId ?? null);
    });
  }
}
