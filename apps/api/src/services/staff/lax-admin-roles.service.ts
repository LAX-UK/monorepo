import type {
  IAdminUserReader,
  ILaxAdminRoleReader,
  ILaxAdminRoleRequestWriter,
  LaxAdminRoleAssignmentRecord,
  LaxAdminRoleRequest,
} from "@auction/persistence/interfaces";
import {
  LAX_ADMIN_ROLE_RULES,
  type LaxShopStaffRole,
  type StaffRoleAssignment,
  isStaffRoleAssignmentCurrent,
  staffRoleRefusalMessage,
} from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import type { IStaffRoleChangeNotifier } from "./staff-role-notices.js";
import type { StaffRolesError } from "./staff-roles-admin.service.js";

/** How long a change LAX Admin has not applied yet shows as waiting. */
const PENDING_WINDOW_MS = 24 * 3_600_000;

/** One LAX Admin role as the staff record shows it. */
export type LaxAdminRoleView = {
  /** The assignment id, or the request's for a role LAX Admin has not added yet. */
  id: string;
  role: LaxShopStaffRole;
  startsAt: string;
  endsAt: string | null;
  grantedAt: string;
  reason: string | null;
  /** A change asked for that LAX Admin has not applied yet. */
  pending: "assign" | "remove" | null;
};

export type LaxAdminRolesOverview = {
  userId: string;
  roles: LaxAdminRoleView[];
  /** Other active LAX Admin administrators; zero means this person's cannot go. */
  otherActiveAdministrators: number;
};

export type ChangeLaxAdminRoleInput = {
  readonly userId: string;
  readonly actorUserId: string;
  readonly role: LaxShopStaffRole;
  readonly reason: string;
};

export type AssignLaxAdminRoleInput = ChangeLaxAdminRoleInput & { readonly endsAt: Date | null };

/** The latest request for each role, where it has not taken effect yet. */
function pendingRequests(
  current: readonly LaxAdminRoleAssignmentRecord[],
  requests: readonly LaxAdminRoleRequest[],
  now: Date,
): LaxAdminRoleRequest[] {
  const latest = new Map<LaxShopStaffRole, LaxAdminRoleRequest>();
  for (const request of requests) if (!latest.has(request.role)) latest.set(request.role, request);
  return [...latest.values()].filter((request) => {
    const held = current.some(
      (a) => a.role === request.role && isStaffRoleAssignmentCurrent(a, now),
    );
    return request.kind === "assign" ? !held : held;
  });
}

/** The person's roles as they will be once LAX Admin applies what was asked for. */
function projected(
  current: readonly LaxAdminRoleAssignmentRecord[],
  pending: readonly LaxAdminRoleRequest[],
): StaffRoleAssignment<LaxShopStaffRole>[] {
  const removing = new Set(pending.filter((p) => p.kind === "remove").map((p) => p.role));
  return [
    ...current.filter((a) => !removing.has(a.role)),
    ...pending
      .filter((p) => p.kind === "assign")
      .map((p) => ({ role: p.role, startsAt: p.at, endsAt: p.endsAt })),
  ];
}

/**
 * A person's LAX Admin roles on their Bid staff record: what they hold, what is waiting for LAX
 * Admin to apply, and giving or removing a role. Every change is checked with the role rules LAX
 * Admin applies (the shared engine, LAX Admin's table) before it is asked for, then the person
 * and LAX Admin's administrators are told. Who may call each is decided by the route's guard.
 */
export class LaxAdminRolesService {
  constructor(
    private readonly deps: {
      roles: ILaxAdminRoleReader;
      requests: ILaxAdminRoleRequestWriter;
      users: Pick<IAdminUserReader, "getById">;
      notifier: IStaffRoleChangeNotifier;
      clock?: () => Date;
    },
  ) {}

  private now(): Date {
    return this.deps.clock?.() ?? new Date();
  }

  private async state(userId: string, now: Date) {
    const [current, requests, otherActiveAdministrators] = await Promise.all([
      this.deps.roles.listCurrent(userId, now),
      this.deps.roles.listRequestsSince(userId, new Date(now.getTime() - PENDING_WINDOW_MS)),
      this.deps.roles.countOtherActiveAdministrators(userId, now),
    ]);
    return {
      current,
      pending: pendingRequests(current, requests, now),
      otherActiveAdministrators,
    };
  }

  async overview(userId: string): Promise<Result<LaxAdminRolesOverview, StaffRolesError>> {
    if (!(await this.deps.users.getById(userId))) {
      return err({ status: 404, message: "Person not found" });
    }
    const now = this.now();
    const { current, pending, otherActiveAdministrators } = await this.state(userId, now);
    const removing = new Set(pending.filter((p) => p.kind === "remove").map((p) => p.role));
    const roles: LaxAdminRoleView[] = [
      ...current.map((a) => ({
        id: a.id,
        role: a.role,
        startsAt: a.startsAt.toISOString(),
        endsAt: a.endsAt?.toISOString() ?? null,
        grantedAt: a.grantedAt.toISOString(),
        reason: a.reason,
        pending: removing.has(a.role) ? ("remove" as const) : null,
      })),
      ...pending
        .filter((p) => p.kind === "assign")
        .map((p) => ({
          id: `request-${p.eventId}`,
          role: p.role,
          startsAt: p.at.toISOString(),
          endsAt: p.endsAt?.toISOString() ?? null,
          grantedAt: p.at.toISOString(),
          reason: null,
          pending: "assign" as const,
        })),
    ];
    return ok({ userId, roles, otherActiveAdministrators });
  }

  async assign(input: AssignLaxAdminRoleInput): Promise<Result<void, StaffRolesError>> {
    return this.change(input, { kind: "assign", endsAt: input.endsAt });
  }

  async remove(input: ChangeLaxAdminRoleInput): Promise<Result<void, StaffRolesError>> {
    return this.change(input, { kind: "remove", endsAt: null });
  }

  private async change(
    input: ChangeLaxAdminRoleInput,
    kind: { kind: "assign" | "remove"; endsAt: Date | null },
  ): Promise<Result<void, StaffRolesError>> {
    if (!(await this.deps.users.getById(input.userId))) {
      return err({ status: 404, message: "Person not found" });
    }
    const now = this.now();
    const { current, pending, otherActiveAdministrators } = await this.state(input.userId, now);
    const requested: Parameters<typeof LAX_ADMIN_ROLE_RULES.check>[1] =
      kind.kind === "assign"
        ? { kind: "assign", role: input.role, startsAt: now, endsAt: kind.endsAt }
        : { kind: "remove", role: input.role };
    const check = LAX_ADMIN_ROLE_RULES.check(projected(current, pending), requested, now, {
      otherActiveAdministrators,
    });
    if (!check.ok) {
      return err({
        status: 409,
        code: check.reason,
        message: staffRoleRefusalMessage({
          product: "shop",
          reason: check.reason,
          role: input.role,
          conflictingRole: check.conflictingRole,
        }),
      });
    }

    if (kind.kind === "assign") {
      await this.deps.requests.requestGrant({
        subjectId: input.userId,
        role: input.role,
        endsAt: kind.endsAt,
        reason: input.reason,
        actorSubjectId: input.actorUserId,
      });
    } else {
      await this.deps.requests.requestRemoval({
        subjectId: input.userId,
        role: input.role,
        reason: input.reason,
        actorSubjectId: input.actorUserId,
      });
    }
    await this.deps.notifier.notifyChanged(
      {
        product: "shop",
        subjectId: input.userId,
        actorSubjectId: input.actorUserId,
        role: input.role,
        change: kind.kind === "assign" ? "given" : "removed",
        endsAt: kind.endsAt,
        reason: input.reason,
        requestedAt: now,
      },
      now,
    );
    return ok(undefined);
  }
}
