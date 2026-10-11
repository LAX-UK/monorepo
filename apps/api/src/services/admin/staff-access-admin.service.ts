import type {
  IAdminUserReader,
  ILaxStaffAccessRepository,
  LaxStaffAccessEntry,
  LaxStaffAccessHistoryEntry,
} from "@auction/persistence/interfaces";
import {
  LAX_STAFF_PLATFORMS,
  type LaxStaffAccessProduct,
  USERS_DIRECTORY_ACCESS,
  type UserRole,
  laxStaffRoleOption,
  normalizeUserStaffRole,
  roleHasCapability,
  userHasAccessTo,
} from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import type { IIdentityTwoFactorPolicyClient } from "../interfaces/identity-issuer-client.js";

export type StaffAccessActor = {
  userId: string;
  role: string;
  staffRole: string | null | undefined;
};

export type StaffAccessError = { status: 400 | 403 | 404; message: string };

export type StaffAccessSummary = {
  subjectId: string;
  platforms: { product: LaxStaffAccessProduct; role: string }[];
  twoFactorEnabled: boolean | null;
  lastSignInAt: string | null;
};

export type StaffAccessPendingChange = {
  action: "granted" | "revoked";
  role: string | null;
  requestedAt: string;
};

export type StaffAccessPlatformView = {
  product: LaxStaffAccessProduct;
  role: string | null;
  updatedAt: string | null;
  pending: StaffAccessPendingChange | null;
};

export type StaffAccessHistoryView = {
  at: string;
  product: LaxStaffAccessProduct;
  action: "granted" | "revoked";
  role: string | null;
  actorSubjectId: string;
  actorName: string | null;
  viaInvitation: boolean;
};

export type StaffAccessDetail = {
  subjectId: string;
  platforms: StaffAccessPlatformView[];
  history: StaffAccessHistoryView[];
};

/** Platforms other than Bid apply their own roles from `lax.staff_access.*` events (D36). */
export type RemoteStaffAccessProduct = Exclude<LaxStaffAccessProduct, "bid">;

const HISTORY_LIMIT = 50;
export const STAFF_ACCESS_SUMMARY_BATCH = 100;

const forbidden: StaffAccessError = { status: 403, message: "forbidden" };

/**
 * Central "LAX access" view for Bid admin: what each person holds on every platform,
 * who changed it and whether a change is still waiting for the owning product.
 */
export class StaffAccessAdminService {
  constructor(
    private readonly deps: {
      access: ILaxStaffAccessRepository;
      users: Pick<IAdminUserReader, "getById" | "getByIds">;
      identity: Pick<IIdentityTwoFactorPolicyClient, "readSecuritySummaries">;
    },
  ) {}

  async summaries(
    actor: StaffAccessActor,
    subjectIds: readonly string[],
  ): Promise<Result<StaffAccessSummary[], StaffAccessError>> {
    if (!canRead(actor)) return err(forbidden);
    const ids = [...new Set(subjectIds)];
    if (ids.length > STAFF_ACCESS_SUMMARY_BATCH) {
      return err({ status: 400, message: "too_many_subjects" });
    }
    const [entries, security] = await Promise.all([
      this.deps.access.listForSubjects(ids),
      this.deps.identity.readSecuritySummaries(ids).catch(() => null),
    ]);
    const bySubject = groupBySubject(entries);
    return ok(
      ids.map((subjectId) => {
        const summary = security?.get(subjectId);
        return {
          subjectId,
          platforms: orderedPlatforms(bySubject.get(subjectId) ?? []).map(({ product, role }) => ({
            product,
            role,
          })),
          twoFactorEnabled: summary?.twoFactorEnabled ?? null,
          lastSignInAt: summary?.lastSignInAt?.toISOString() ?? null,
        };
      }),
    );
  }

  async detail(
    actor: StaffAccessActor,
    subjectId: string,
  ): Promise<Result<StaffAccessDetail, StaffAccessError>> {
    if (!canRead(actor)) return err(forbidden);
    if (!(await this.deps.users.getById(subjectId))) {
      return err({ status: 404, message: "user_not_found" });
    }
    const [entries, history] = await Promise.all([
      this.deps.access.listForSubjects([subjectId]),
      this.deps.access.history(subjectId, HISTORY_LIMIT),
    ]);
    const actorIds = [...new Set(history.map((h) => h.actorSubjectId))];
    const actors = actorIds.length > 0 ? await this.deps.users.getByIds(actorIds) : [];
    const names = new Map(actors.map((a) => [a.id, a.name || a.email]));
    return ok({
      subjectId,
      platforms: LAX_STAFF_PLATFORMS.map(({ product }) =>
        platformView(
          product,
          entries.find((e) => e.product === product) ?? null,
          history.find((h) => h.product === product) ?? null,
        ),
      ),
      history: history.map((h) => ({
        at: h.at.toISOString(),
        product: h.product,
        action: h.action,
        role: h.role,
        actorSubjectId: h.actorSubjectId,
        actorName: names.get(h.actorSubjectId) ?? null,
        viaInvitation: h.invitationId !== null,
      })),
    });
  }

  async setRemoteRole(
    actor: StaffAccessActor,
    subjectId: string,
    product: RemoteStaffAccessProduct,
    role: string,
  ): Promise<Result<StaffAccessDetail, StaffAccessError>> {
    if (!canManage(actor)) return err(forbidden);
    if (!laxStaffRoleOption(product, role)) {
      return err({ status: 400, message: `unknown_${product}_role` });
    }
    if (!(await this.deps.users.getById(subjectId))) {
      return err({ status: 404, message: "user_not_found" });
    }
    await this.deps.access.requestGrant({ subjectId, product, role, actorSubjectId: actor.userId });
    return this.detail(actor, subjectId);
  }

  async revokeRemote(
    actor: StaffAccessActor,
    subjectId: string,
    product: RemoteStaffAccessProduct,
  ): Promise<Result<StaffAccessDetail, StaffAccessError>> {
    if (!canManage(actor)) return err(forbidden);
    if (actor.userId === subjectId) return err({ status: 400, message: "cannot_revoke_self" });
    if (!(await this.deps.users.getById(subjectId))) {
      return err({ status: 404, message: "user_not_found" });
    }
    await this.deps.access.requestRevoke({ subjectId, product, actorSubjectId: actor.userId });
    return this.detail(actor, subjectId);
  }
}

function canRead(actor: StaffAccessActor): boolean {
  return userHasAccessTo(
    actor.role as UserRole,
    normalizeUserStaffRole(actor.staffRole),
    USERS_DIRECTORY_ACCESS,
  );
}

function canManage(actor: StaffAccessActor): boolean {
  return roleHasCapability(
    actor.role as UserRole,
    "user.invite",
    normalizeUserStaffRole(actor.staffRole),
  );
}

function groupBySubject(entries: LaxStaffAccessEntry[]): Map<string, LaxStaffAccessEntry[]> {
  const grouped = new Map<string, LaxStaffAccessEntry[]>();
  for (const entry of entries) {
    grouped.set(entry.subjectId, [...(grouped.get(entry.subjectId) ?? []), entry]);
  }
  return grouped;
}

function orderedPlatforms(entries: LaxStaffAccessEntry[]): LaxStaffAccessEntry[] {
  return LAX_STAFF_PLATFORMS.flatMap(({ product }) => entries.filter((e) => e.product === product));
}

/**
 * A change is pending when Bid recorded it after the owning product last wrote its role
 * and the product's current state does not reflect it yet.
 */
export function platformView(
  product: LaxStaffAccessProduct,
  entry: LaxStaffAccessEntry | null,
  latest: LaxStaffAccessHistoryEntry | null,
): StaffAccessPlatformView {
  const current = {
    product,
    role: entry?.role ?? null,
    updatedAt: entry?.updatedAt.toISOString() ?? null,
  };
  if (!latest || (entry && latest.at <= entry.updatedAt)) return { ...current, pending: null };
  const applied = latest.action === "granted" ? entry?.role === latest.role : entry === null;
  return {
    ...current,
    pending: applied
      ? null
      : { action: latest.action, role: latest.role, requestedAt: latest.at.toISOString() },
  };
}
