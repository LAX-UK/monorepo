import type { Database } from "@auction/db";
import {
  bidIdentityDirectory,
  emailOutbox,
  userInvitation,
  userInvitationProductGrant,
} from "@auction/db/schema";
import type { LaxStaffGrant, UserRole, UserStaffRole } from "@auction/types";
import { type SQL, and, asc, desc, eq, ilike, inArray, isNull, sql } from "drizzle-orm";
import type {
  ConsumeInviteResult,
  IUserInvitationRepository,
  InvitationAdminListFilters,
  InvitationAdminListPage,
  InvitationAdminListRow,
  InvitationAdminListSort,
  InvitationInsert,
  InvitationRow,
  InvitationSummary,
} from "../interfaces/invitation.repository.js";
import { insertLaxStaffAccessEvents } from "./drizzle-lax-staff-access.repository.js";

const inviter = bidIdentityDirectory;

function buildAdminListWhere(filters: InvitationAdminListFilters): SQL | undefined {
  const clauses: SQL[] = [];
  if (filters.status) {
    clauses.push(eq(userInvitation.status, filters.status));
  }
  const q = filters.q?.trim();
  if (q) {
    clauses.push(ilike(userInvitation.email, `%${q}%`));
  }
  if (clauses.length === 0) return undefined;
  return and(...clauses);
}

function adminListOrderBy(sort: InvitationAdminListSort = "created_desc"): SQL[] {
  switch (sort) {
    case "created_asc":
      return [asc(userInvitation.createdAt), asc(userInvitation.id)];
    case "expires_asc":
      return [asc(userInvitation.expiresAt), asc(userInvitation.id)];
    case "expires_desc":
      return [desc(userInvitation.expiresAt), desc(userInvitation.id)];
    case "email_asc":
      return [asc(userInvitation.email), asc(userInvitation.id)];
    case "email_desc":
      return [desc(userInvitation.email), desc(userInvitation.id)];
    default:
      return [desc(userInvitation.createdAt), desc(userInvitation.id)];
  }
}

function mapRow(r: typeof userInvitation.$inferSelect): InvitationRow {
  return {
    id: r.id,
    email: r.email,
    targetRole: r.targetRole as UserRole,
    targetStaffRole: (r.targetStaffRole ?? null) as InvitationRow["targetStaffRole"],
    tokenHash: r.tokenHash,
    status: r.status,
    expiresAt: r.expiresAt,
    openedAt: r.openedAt ?? null,
    lastEmailOutboxId: r.lastEmailOutboxId ?? null,
    acceptedAt: r.acceptedAt ?? null,
    acceptedUserId: r.acceptedUserId ?? null,
    targetLegalEntityId: r.targetLegalEntityId ?? null,
    targetLegalEntityMemberRole: r.targetLegalEntityMemberRole ?? null,
    createdByUserId: r.createdByUserId,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function mapInvitationSummary(r: {
  id: string;
  email: string;
  targetRole: string;
  targetStaffRole: string | null;
  status: InvitationRow["status"];
  expiresAt: Date;
  openedAt: Date | null;
  acceptedAt: Date | null;
  acceptedUserId: string | null;
  targetLegalEntityId: string | null;
  targetLegalEntityMemberRole: string | null;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}): InvitationSummary {
  return {
    id: r.id,
    email: r.email,
    targetRole: r.targetRole as UserRole,
    targetStaffRole: (r.targetStaffRole ?? null) as UserStaffRole | null,
    status: r.status,
    expiresAt: r.expiresAt,
    openedAt: r.openedAt ?? null,
    acceptedAt: r.acceptedAt ?? null,
    acceptedUserId: r.acceptedUserId ?? null,
    targetLegalEntityId: r.targetLegalEntityId ?? null,
    targetLegalEntityMemberRole: r.targetLegalEntityMemberRole ?? null,
    createdByUserId: r.createdByUserId,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

async function selectGrants(
  db: Database,
  invitationIds: string[],
): Promise<Map<string, LaxStaffGrant[]>> {
  const byInvitation = new Map<string, LaxStaffGrant[]>();
  if (invitationIds.length === 0) return byInvitation;
  const rows = await db
    .select({
      invitationId: userInvitationProductGrant.invitationId,
      product: userInvitationProductGrant.product,
      role: userInvitationProductGrant.role,
    })
    .from(userInvitationProductGrant)
    .where(inArray(userInvitationProductGrant.invitationId, invitationIds))
    .orderBy(asc(userInvitationProductGrant.product), asc(userInvitationProductGrant.role));
  for (const r of rows) {
    const list = byInvitation.get(r.invitationId) ?? [];
    list.push({ product: r.product, role: r.role });
    byInvitation.set(r.invitationId, list);
  }
  return byInvitation;
}

export class DrizzleUserInvitationRepository implements IUserInvitationRepository {
  constructor(
    private readonly db: Database,
    private readonly producer = "apps/api",
  ) {}

  async insert(row: InvitationInsert): Promise<void> {
    await this.db.transaction(async (tx) => {
      await this.insertInvitation(tx, row);
      if (row.grants && row.grants.length > 0) {
        await tx
          .insert(userInvitationProductGrant)
          .values(
            row.grants.map((g) => ({ invitationId: row.id, product: g.product, role: g.role })),
          );
      }
    });
  }

  private async insertInvitation(tx: Database, row: InvitationInsert): Promise<void> {
    await tx.insert(userInvitation).values({
      id: row.id,
      email: row.email,
      targetRole: row.targetRole,
      targetStaffRole: row.targetStaffRole,
      tokenHash: row.tokenHash,
      status: row.status,
      expiresAt: row.expiresAt,
      openedAt: row.openedAt ?? null,
      lastEmailOutboxId: row.lastEmailOutboxId ?? null,
      acceptedAt: row.acceptedAt,
      acceptedUserId: row.acceptedUserId,
      targetLegalEntityId: row.targetLegalEntityId ?? null,
      targetLegalEntityMemberRole: row.targetLegalEntityMemberRole ?? null,
      createdByUserId: row.createdByUserId,
    });
  }

  async findById(id: string): Promise<InvitationRow | null> {
    const [row] = await this.db
      .select()
      .from(userInvitation)
      .where(eq(userInvitation.id, id))
      .limit(1);
    return row ? mapRow(row) : null;
  }

  async findPendingByTokenHash(tokenHash: string): Promise<InvitationRow | null> {
    const [row] = await this.db
      .select()
      .from(userInvitation)
      .where(and(eq(userInvitation.tokenHash, tokenHash), eq(userInvitation.status, "pending")))
      .limit(1);
    return row ? mapRow(row) : null;
  }

  async findPendingPlatformByEmail(email: string): Promise<InvitationRow | null> {
    const normalized = email.trim().toLowerCase();
    const [row] = await this.db
      .select()
      .from(userInvitation)
      .where(
        and(
          sql`lower(${userInvitation.email}) = ${normalized}`,
          eq(userInvitation.status, "pending"),
          isNull(userInvitation.targetLegalEntityId),
        ),
      )
      .limit(1);
    return row ? mapRow(row) : null;
  }

  async listGrants(invitationId: string): Promise<LaxStaffGrant[]> {
    return (await selectGrants(this.db, [invitationId])).get(invitationId) ?? [];
  }

  accept(tokenHash: string, userId: string, email: string): Promise<ConsumeInviteResult> {
    return this.db.transaction(async (tx) => {
      // Row lock serializes concurrent redemptions of the same token: the loser
      // blocks here and then sees status != 'pending'.
      const [row] = await tx
        .select()
        .from(userInvitation)
        .where(eq(userInvitation.tokenHash, tokenHash))
        .limit(1)
        .for("update");
      if (!row || row.status !== "pending") return { outcome: "invalid" };
      if (row.expiresAt.getTime() <= Date.now()) {
        await tx
          .update(userInvitation)
          .set({ status: "expired", updatedAt: new Date() })
          .where(eq(userInvitation.id, row.id));
        return { outcome: "expired" };
      }
      if (row.email.toLowerCase() !== email.trim().toLowerCase()) {
        return { outcome: "email_mismatch" };
      }

      const grants = (await selectGrants(tx, [row.id])).get(row.id) ?? [];
      const targetRole = row.targetRole as UserRole;
      const now = new Date();

      await tx
        .update(userInvitation)
        .set({ status: "accepted", acceptedAt: now, acceptedUserId: userId, updatedAt: now })
        .where(eq(userInvitation.id, row.id));

      // Bid access is applied by the caller through the staff roster in this same transaction;
      // other platforms apply their roles from these events.
      await insertLaxStaffAccessEvents(
        tx,
        this.producer,
        grants
          .filter((g) => g.product !== "bid")
          .map((g) => ({
            type: "lax.staff_access.granted" as const,
            payload: {
              schemaVersion: 1 as const,
              subjectId: userId,
              product: g.product,
              role: g.role,
              grantedBySubjectId: row.createdByUserId,
              invitationId: row.id,
            },
          })),
      );

      return {
        outcome: "ok",
        invitationId: row.id,
        invitedByUserId: row.createdByUserId,
        targetRole,
        targetStaffRole: (row.targetStaffRole ?? null) as UserStaffRole | null,
        grants,
      };
    });
  }

  async counts(
    filters: InvitationAdminListFilters,
  ): Promise<{ total: number; pending: number; accepted: number }> {
    const filteredWhere = buildAdminListWhere(filters);
    const countBase = this.db
      .select({
        total: sql<number>`count(*)::int`,
        pending: sql<number>`count(*) filter (where ${userInvitation.status} = 'pending')::int`,
        accepted: sql<number>`count(*) filter (where ${userInvitation.status} = 'accepted')::int`,
      })
      .from(userInvitation);
    const [row] = filteredWhere ? await countBase.where(filteredWhere) : await countBase;
    return {
      total: row?.total ?? 0,
      pending: row?.pending ?? 0,
      accepted: row?.accepted ?? 0,
    };
  }

  async listAdmin(
    filters: InvitationAdminListFilters,
    page: InvitationAdminListPage,
  ): Promise<InvitationAdminListRow[]> {
    const inviteEmailLastStatus = emailOutbox.status;
    const invitedByName = sql<string | null>`coalesce(${inviter.name}, ${inviter.email})`;
    const where = buildAdminListWhere(filters);
    const rows = await this.db
      .select({
        id: userInvitation.id,
        email: userInvitation.email,
        targetRole: userInvitation.targetRole,
        targetStaffRole: userInvitation.targetStaffRole,
        status: userInvitation.status,
        expiresAt: userInvitation.expiresAt,
        openedAt: userInvitation.openedAt,
        acceptedAt: userInvitation.acceptedAt,
        acceptedUserId: userInvitation.acceptedUserId,
        targetLegalEntityId: userInvitation.targetLegalEntityId,
        targetLegalEntityMemberRole: userInvitation.targetLegalEntityMemberRole,
        createdByUserId: userInvitation.createdByUserId,
        createdAt: userInvitation.createdAt,
        updatedAt: userInvitation.updatedAt,
        inviteEmailLastStatus,
        invitedByName,
      })
      .from(userInvitation)
      .leftJoin(emailOutbox, eq(userInvitation.lastEmailOutboxId, emailOutbox.id))
      .leftJoin(inviter, eq(userInvitation.createdByUserId, inviter.subjectId))
      .where(where)
      .orderBy(...adminListOrderBy(page.sort))
      .limit(page.limit)
      .offset(page.offset);
    const grants = await selectGrants(
      this.db,
      rows.map((r) => r.id),
    );
    return rows.map((r) => ({
      ...mapInvitationSummary(r),
      grants: grants.get(r.id) ?? [],
      inviteEmailLastStatus: r.inviteEmailLastStatus ?? null,
      invitedByName: r.invitedByName ?? null,
    }));
  }

  async updateStatus(
    id: string,
    patch: Partial<
      Pick<
        InvitationRow,
        | "status"
        | "acceptedAt"
        | "acceptedUserId"
        | "tokenHash"
        | "expiresAt"
        | "openedAt"
        | "lastEmailOutboxId"
      >
    >,
  ): Promise<void> {
    await this.db
      .update(userInvitation)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(userInvitation.id, id));
  }

  async markOpenedFirstTouch(id: string): Promise<void> {
    const existing = await this.findById(id);
    if (!existing || existing.openedAt) return;
    await this.updateStatus(id, { openedAt: new Date() });
  }
}
