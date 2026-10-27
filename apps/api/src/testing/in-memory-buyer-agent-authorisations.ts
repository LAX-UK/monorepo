import type {
  BuyerAgentAuthorisationRecord,
  IBuyerAgentAuthorisationDirectory,
  IBuyerAgentAuthorisationWriter,
  NewBuyerAgentAuthorisation,
} from "@auction/persistence/interfaces";
import type { LegalEntityMemberRole, Sale } from "@auction/types";
import { vi } from "vitest";
import { BuyerAgentAuthorisationService } from "../services/buyer-agents/buyer-agent-authorisation.service.js";
import type { IDomainEventSink } from "../services/domain-event-sink.js";

export const ENTITY_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
export const OPEN_SALE_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
export const ENDED_SALE_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
export const NOW = new Date("2026-10-27T12:00:00Z");

/** An in-memory authorisation store with the same scope rule as the database. */
export class InMemoryBuyerAgentAuthorisations
  implements IBuyerAgentAuthorisationDirectory, IBuyerAgentAuthorisationWriter
{
  readonly rows: BuyerAgentAuthorisationRecord[] = [];
  private seq = 0;

  async listForLegalEntity(legalEntityId: string) {
    return this.rows.filter((r) => r.legalEntityId === legalEntityId);
  }

  async findForLegalEntity(legalEntityId: string, id: string) {
    return this.rows.find((r) => r.legalEntityId === legalEntityId && r.id === id) ?? null;
  }

  async grant(input: NewBuyerAgentAuthorisation, supersededReason: string) {
    const previous = this.rows.find(
      (r) =>
        r.status === "active" &&
        r.legalEntityId === input.legalEntityId &&
        r.userId === input.userId &&
        r.saleId === input.saleId,
    );
    if (previous) {
      previous.status = "revoked";
      previous.revokedAt = NOW;
      previous.revokedReason = supersededReason;
    }
    this.seq += 1;
    const id = `00000000-0000-4000-8000-${String(this.seq).padStart(12, "0")}`;
    this.rows.push({
      id,
      ...input,
      userName: "Adam Agent",
      userEmail: "adam@example.test",
      saleTitle: input.saleId ? "Modern British" : null,
      status: "active",
      createdByName: "Olivia Owner",
      createdAt: NOW,
      revokedAt: null,
      revokedReason: null,
    });
    return { id, supersededId: previous?.id ?? null };
  }

  async revoke(input: {
    legalEntityId: string;
    authorisationId: string;
    reason: string;
    revokedAt: Date;
  }) {
    const row = this.rows.find(
      (r) =>
        r.id === input.authorisationId &&
        r.legalEntityId === input.legalEntityId &&
        r.status === "active",
    );
    if (!row) return false;
    row.status = "revoked";
    row.revokedAt = input.revokedAt;
    row.revokedReason = input.reason;
    return true;
  }
}

type Member = { userId: string; role: LegalEntityMemberRole; accepted?: boolean };

/** The service over in-memory members, sales and store, with a spy event sink. */
export function buildBuyerAgentAuthorisationService(
  members: Member[] = [
    { userId: "owner-1", role: "owner" },
    { userId: "agent-1", role: "buyer_agent" },
    { userId: "viewer-1", role: "viewer" },
  ],
) {
  const store = new InMemoryBuyerAgentAuthorisations();
  const publish = vi.fn().mockResolvedValue(undefined);
  const events: IDomainEventSink = { publish, withTx: () => events };
  const sales: Record<string, Pick<Sale, "id" | "title" | "status" | "startTime">> = {
    [OPEN_SALE_ID]: {
      id: OPEN_SALE_ID,
      title: "Modern British",
      status: "scheduled",
      startTime: new Date("2026-11-20T10:00:00Z"),
    },
    [ENDED_SALE_ID]: {
      id: ENDED_SALE_ID,
      title: "Spring sale",
      status: "ended",
      startTime: new Date("2026-04-01T10:00:00Z"),
    },
  };
  const service = new BuyerAgentAuthorisationService({
    directory: store,
    writer: store,
    members: {
      listMembersWithUsers: async () =>
        members.map((m) => ({
          id: `member-${m.userId}`,
          legalEntityId: ENTITY_ID,
          userId: m.userId,
          role: m.role,
          isPrimaryAdmin: m.role === "owner",
          invitedAt: null,
          acceptedAt: m.accepted === false ? null : NOW,
          removedAt: null,
          createdAt: NOW,
          updatedAt: NOW,
          user: { id: m.userId, email: `${m.userId}@example.test`, name: m.userId, image: null },
        })) as never,
    },
    sales: {
      findById: async (id: string) => (sales[id] ?? null) as Sale | null,
      findWithStatuses: async () => [sales[OPEN_SALE_ID]] as Sale[],
    },
    events,
    now: () => NOW,
  });
  return { service, store, publish };
}
