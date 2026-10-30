import type { Database } from "@auction/db";
import { accessRequest, bidIdentityDirectory, legalEntityMember } from "@auction/db/schema";
import type { AccessRequestStatus } from "@auction/domain";
import type { LegalEntityMemberRole } from "@auction/types";
import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import type {
  AccessRequestDecision,
  AccessRequestRow,
  IAccessRequestRepository,
  IActiveMemberLookup,
  NewAccessRequest,
} from "../interfaces/access-request.repository.js";

const COLUMNS = {
  id: accessRequest.id,
  legalEntityId: accessRequest.legalEntityId,
  requesterUserId: accessRequest.requesterUserId,
  requesterName: bidIdentityDirectory.name,
  requestedRole: accessRequest.requestedRole,
  requestedCapability: accessRequest.requestedCapability,
  reason: accessRequest.reason,
  status: accessRequest.status,
  grantedRole: accessRequest.grantedRole,
  decidedByUserId: accessRequest.decidedByUserId,
  decidedAt: accessRequest.decidedAt,
  decisionNote: accessRequest.decisionNote,
  createdAt: accessRequest.createdAt,
};

type Selected = {
  [K in keyof typeof COLUMNS]: (typeof COLUMNS)[K]["_"]["data"] | null;
};

function toRow(row: Selected): AccessRequestRow {
  return {
    ...(row as AccessRequestRow),
    requesterName: row.requesterName ?? null,
    requestedRole: (row.requestedRole as LegalEntityMemberRole | null) ?? null,
    grantedRole: (row.grantedRole as LegalEntityMemberRole | null) ?? null,
    status: row.status as AccessRequestStatus,
  };
}

export class DrizzleAccessRequestRepository
  implements IAccessRequestRepository, IActiveMemberLookup
{
  constructor(private readonly db: Database) {}

  private select() {
    return this.db
      .select(COLUMNS)
      .from(accessRequest)
      .leftJoin(
        bidIdentityDirectory,
        eq(bidIdentityDirectory.subjectId, accessRequest.requesterUserId),
      );
  }

  private samePending(input: NewAccessRequest) {
    return and(
      eq(accessRequest.legalEntityId, input.legalEntityId),
      eq(accessRequest.requesterUserId, input.requesterUserId),
      eq(accessRequest.status, "pending"),
      sql`coalesce(${accessRequest.requestedRole}, '') = ${input.requestedRole ?? ""}`,
      sql`coalesce(${accessRequest.requestedCapability}, '') = ${input.requestedCapability ?? ""}`,
    );
  }

  async openOrFindPending(
    input: NewAccessRequest,
  ): Promise<{ row: AccessRequestRow; created: boolean }> {
    const inserted = await this.db
      .insert(accessRequest)
      .values({ ...input, status: "pending" })
      .onConflictDoNothing()
      .returning({ id: accessRequest.id });
    const [row] = await this.select().where(this.samePending(input)).limit(1);
    if (!row) throw new Error("access_request_open_failed");
    return { row: toRow(row), created: inserted.length > 0 };
  }

  async find(legalEntityId: string, id: string): Promise<AccessRequestRow | null> {
    const [row] = await this.select()
      .where(and(eq(accessRequest.id, id), eq(accessRequest.legalEntityId, legalEntityId)))
      .limit(1);
    return row ? toRow(row) : null;
  }

  async list(input: {
    legalEntityId: string;
    requesterUserId: string | null;
    status?: AccessRequestStatus | undefined;
    limit: number;
  }): Promise<AccessRequestRow[]> {
    const rows = await this.select()
      .where(
        and(
          eq(accessRequest.legalEntityId, input.legalEntityId),
          input.requesterUserId
            ? eq(accessRequest.requesterUserId, input.requesterUserId)
            : undefined,
          input.status ? eq(accessRequest.status, input.status) : undefined,
        ),
      )
      .orderBy(desc(accessRequest.createdAt), desc(accessRequest.id))
      .limit(input.limit);
    return rows.map(toRow);
  }

  async close(id: string, decision: AccessRequestDecision): Promise<AccessRequestRow | null> {
    const updated = await this.db
      .update(accessRequest)
      .set({
        status: decision.status,
        decidedByUserId: decision.decidedByUserId,
        decidedAt: new Date(),
        grantedRole: decision.grantedRole ?? null,
        decisionNote: decision.decisionNote ?? null,
      })
      .where(and(eq(accessRequest.id, id), eq(accessRequest.status, "pending")))
      .returning({ legalEntityId: accessRequest.legalEntityId });
    const [first] = updated;
    return first ? this.find(first.legalEntityId, id) : null;
  }

  async activeMember(
    legalEntityId: string,
    userId: string,
  ): Promise<{ memberId: string; role: LegalEntityMemberRole } | null> {
    const [row] = await this.db
      .select({ memberId: legalEntityMember.id, role: legalEntityMember.role })
      .from(legalEntityMember)
      .where(
        and(
          eq(legalEntityMember.legalEntityId, legalEntityId),
          eq(legalEntityMember.userId, userId),
          isNull(legalEntityMember.removedAt),
          isNotNull(legalEntityMember.acceptedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }
}
