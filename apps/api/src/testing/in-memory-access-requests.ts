import type {
  AccessRequestDecision,
  AccessRequestRow,
  IAccessRequestRepository,
  IActiveMemberLookup,
  NewAccessRequest,
} from "@auction/persistence/interfaces";
import type { LegalEntityMemberRole } from "@auction/types";
import { vi } from "vitest";
import { AccessRequestService } from "../services/organisation-access/access-request.service.js";

export const ACCESS_ACCOUNT = "11111111-1111-4111-8111-111111111111";

/** Requests and memberships in memory, with the same pending-uniqueness as the table. */
export class InMemoryAccessRequests implements IAccessRequestRepository, IActiveMemberLookup {
  readonly rows: AccessRequestRow[] = [];
  readonly members = new Map<string, { memberId: string; role: LegalEntityMemberRole }>();
  private seq = 0;

  async openOrFindPending(input: NewAccessRequest) {
    const pending = this.rows.find(
      (r) =>
        r.legalEntityId === input.legalEntityId &&
        r.requesterUserId === input.requesterUserId &&
        r.status === "pending" &&
        r.requestedRole === input.requestedRole &&
        r.requestedCapability === input.requestedCapability,
    );
    if (pending) return { row: { ...pending }, created: false };
    const row: AccessRequestRow = {
      id: `00000000-0000-4000-8000-${String(++this.seq).padStart(12, "0")}`,
      ...input,
      requesterName: "Lena Fischer",
      status: "pending",
      grantedRole: null,
      decidedByUserId: null,
      decidedAt: null,
      decisionNote: null,
      createdAt: new Date("2026-11-10T12:00:00Z"),
    };
    this.rows.push(row);
    return { row: { ...row }, created: true };
  }

  async find(legalEntityId: string, id: string) {
    const row = this.rows.find((r) => r.id === id && r.legalEntityId === legalEntityId);
    return row ? { ...row } : null;
  }

  async list(input: { legalEntityId: string; requesterUserId: string | null }) {
    return this.rows
      .filter((r) => r.legalEntityId === input.legalEntityId)
      .filter((r) => !input.requesterUserId || r.requesterUserId === input.requesterUserId)
      .map((r) => ({ ...r }));
  }

  async close(id: string, decision: AccessRequestDecision) {
    const row = this.rows.find((r) => r.id === id);
    if (!row || row.status !== "pending") return null;
    Object.assign(row, {
      status: decision.status,
      decidedByUserId: decision.decidedByUserId,
      decidedAt: new Date(),
      grantedRole: decision.grantedRole ?? null,
      decisionNote: decision.decisionNote ?? null,
    });
    return { ...row };
  }

  async activeMember(_legalEntityId: string, userId: string) {
    return this.members.get(userId) ?? null;
  }
}

/** The service over the in-memory store, with spies on the role change, notices and events. */
export function buildAccessRequestService() {
  const store = new InMemoryAccessRequests();
  for (const role of ["owner", "admin", "finance", "consignor", "viewer", "buyer_agent"] as const) {
    store.members.set(`${role}-1`, { memberId: `member-${role}`, role });
  }
  const roles = { change: vi.fn(async () => ({ ok: true as const })) };
  const notifier = { requested: vi.fn(async () => {}), decided: vi.fn(async () => {}) };
  const events = { publish: vi.fn(async () => {}), withTx: vi.fn() };
  const service = new AccessRequestService({
    requests: store,
    members: store,
    roles,
    notifier,
    events: events as never,
  });
  return { service, store, roles, notifier, events };
}
