import type { ShopStaffRole } from "@auction/shop-domain";
import {
  LAX_ADMIN_ROLE_RULES,
  type StaffRoleAssignmentRefusal,
  activeLaxAdminRoles,
  isStaffRoleAssignmentCurrent,
  primaryLaxAdminRole,
} from "@auction/types";
import type {
  ShopStaffRoleAssignmentRecord,
  ShopStaffRoster,
  ShopStaffRosterTransaction,
} from "../ports/shop-staff-roster.js";

/** A requested LAX Admin role change broke a roster rule; nothing was written. */
export class ShopStaffRoleRefused extends Error {
  constructor(
    readonly reason: Exclude<StaffRoleAssignmentRefusal, "duplicate" | "not_assigned">,
    readonly role: ShopStaffRole,
    readonly conflictingRole?: ShopStaffRole,
  ) {
    super(
      `shop_staff_role_refused:${reason}:${role}${conflictingRole ? `:${conflictingRole}` : ""}`,
    );
    this.name = "ShopStaffRoleRefused";
  }
}

/** Applied, or already the case (the role was held, or was not): nothing to change. */
export type ShopStaffRosterOutcome = "applied" | "unchanged";

type Attribution = {
  readonly subjectId: string;
  readonly actorSubjectId: string;
  readonly reason: string | null;
  /** The Bid event the change comes from, so Bid can see it was applied. */
  readonly eventId: number | null;
};

export type AssignShopStaffRoleInput = Attribution & {
  readonly role: ShopStaffRole;
  /** Null: until removed. */
  readonly endsAt: Date | null;
};

export type RemoveShopStaffRoleInput = Attribution & {
  /** One role, or every role the person holds when null. */
  readonly role: ShopStaffRole | null;
};

export type RecordShopStaffRoleExpiryInput = Attribution & { readonly assignmentId: string };

function snapshot(a: ShopStaffRoleAssignmentRecord) {
  return {
    identitySubjectId: a.subjectId,
    role: a.role,
    startsAt: a.startsAt.toISOString(),
    endsAt: a.endsAt?.toISOString() ?? null,
    reason: a.reason,
  };
}

/**
 * Gives, removes and records the end of LAX Admin roles. Every change is checked with the role
 * rules Bid admin uses (one engine, LAX Admin's table), written with its audit entry, and keeps
 * the staff record's primary role in step, all in one roster transaction.
 */
export class ShopStaffRosterService {
  constructor(
    private readonly roster: ShopStaffRoster,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  assign(input: AssignShopStaffRoleInput): Promise<ShopStaffRosterOutcome> {
    return this.roster.transact(async (tx) => {
      const now = this.clock();
      const [current, others] = await Promise.all([
        tx.listCurrent(input.subjectId, now),
        tx.countOtherActiveAdministrators(input.subjectId, now),
      ]);
      const check = LAX_ADMIN_ROLE_RULES.check(
        current,
        { kind: "assign", role: input.role, startsAt: now, endsAt: input.endsAt },
        now,
        { otherActiveAdministrators: others },
      );
      if (!check.ok) {
        // Already held: giving it again changes nothing.
        if (check.reason === "duplicate" || check.reason === "not_assigned") return "unchanged";
        throw new ShopStaffRoleRefused(check.reason, input.role, check.conflictingRole);
      }
      await tx.ensureMember(input.subjectId, input.role);
      const record = await tx.insert({
        subjectId: input.subjectId,
        role: input.role,
        startsAt: now,
        endsAt: input.endsAt,
        grantedBySubjectId: input.actorSubjectId,
        reason: input.reason,
        grantedEventId: input.eventId,
      });
      await tx.audit({
        actorSubjectId: input.actorSubjectId,
        action: "staff_role_assign",
        assignmentId: record.id,
        before: null,
        after: snapshot(record),
      });
      await this.refreshMember(tx, input.subjectId, [...current, record], now);
      return "applied";
    });
  }

  remove(input: RemoveShopStaffRoleInput): Promise<ShopStaffRosterOutcome> {
    return this.roster.transact(async (tx) => {
      const now = this.clock();
      const [current, others] = await Promise.all([
        tx.listCurrent(input.subjectId, now),
        tx.countOtherActiveAdministrators(input.subjectId, now),
      ]);
      const roles = input.role ? [input.role] : [...new Set(current.map((a) => a.role))];
      const ending = current.filter(
        (a) => roles.includes(a.role) && isStaffRoleAssignmentCurrent(a, now),
      );
      if (ending.length === 0) return "unchanged";
      for (const role of roles) {
        const check = LAX_ADMIN_ROLE_RULES.check(current, { kind: "remove", role }, now, {
          otherActiveAdministrators: others,
        });
        if (!check.ok && check.reason === "last_administrator") {
          throw new ShopStaffRoleRefused("last_administrator", role);
        }
      }
      for (const assignment of ending) {
        await tx.end(assignment.id, now, input.eventId);
        await tx.audit({
          actorSubjectId: input.actorSubjectId,
          action: "staff_role_remove",
          assignmentId: assignment.id,
          before: snapshot(assignment),
          after: {
            ...snapshot(assignment),
            endsAt: now.toISOString(),
            removalReason: input.reason,
          },
        });
      }
      const left = current.filter((a) => !ending.includes(a));
      await this.refreshMember(tx, input.subjectId, left, now);
      return "applied";
    });
  }

  /**
   * Records the end of one role whose end date has passed. The role already gives nothing; this
   * writes the audit entry and refreshes the staff record. A second run changes nothing.
   */
  recordExpiry(input: RecordShopStaffRoleExpiryInput): Promise<ShopStaffRosterOutcome> {
    return this.roster.transact(async (tx) => {
      const now = this.clock();
      const assignment = await tx.findById(input.assignmentId);
      if (
        !assignment ||
        assignment.subjectId !== input.subjectId ||
        assignment.endRecordedAt !== null ||
        assignment.endsAt === null ||
        assignment.endsAt.getTime() > now.getTime()
      ) {
        return "unchanged";
      }
      await tx.recordEnd(assignment.id, now, input.eventId);
      await tx.audit({
        actorSubjectId: input.actorSubjectId,
        action: "staff_role_expire",
        assignmentId: assignment.id,
        before: snapshot(assignment),
        after: { ...snapshot(assignment), endRecordedAt: now.toISOString() },
      });
      await this.refreshMember(
        tx,
        input.subjectId,
        await tx.listCurrent(input.subjectId, now),
        now,
      );
      return "applied";
    });
  }

  private async refreshMember(
    tx: ShopStaffRosterTransaction,
    subjectId: string,
    assignments: readonly ShopStaffRoleAssignmentRecord[],
    now: Date,
  ): Promise<void> {
    await tx.writeMember(
      subjectId,
      primaryLaxAdminRole(activeLaxAdminRoles(assignments, now)),
      now,
    );
  }
}
