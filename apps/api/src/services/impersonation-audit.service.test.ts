import type {
  IImpersonationDomainEventReader,
  ITransactionRunner,
} from "@auction/persistence/interfaces";
import { encodeActingContextCookie } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import type { IDomainEventSink } from "./domain-event-sink.js";
import { ImpersonationAuditService } from "./impersonation-audit.service.js";

const OWN_SID = "22222222-2222-4222-8222-222222222222";
const FOREIGN_SID = "33333333-3333-4333-8333-333333333333";
const ENTITY = "11111111-1111-4111-8111-111111111111";

type SessionRow = {
  id: string;
  actorUserId: string;
  targetLegalEntityId: string;
  endedAt: Date | null;
};

const EXPIRED_SID = "44444444-4444-4444-8444-444444444444";

function setup(options: { live: string[]; rows?: SessionRow[]; started?: string[] }) {
  const publish = vi.fn().mockResolvedValue(undefined);
  const rows = options.rows ?? [];
  const endForActor = vi.fn(async (id: string, actor: string) => {
    const row = rows.find((r) => r.id === id && r.actorUserId === actor && !r.endedAt);
    if (row) row.endedAt = new Date();
    return Boolean(row);
  });
  const sessions = {
    listActiveByActor: vi.fn().mockResolvedValue(options.live.map((id) => ({ id }))),
    findById: vi.fn(async (id: string) => rows.find((r) => r.id === id) ?? null),
    endForActor,
    forConnection: () => sessions,
  };
  const reader = {
    findStartedEvent: vi.fn(),
    hasEndedEvent: vi.fn().mockResolvedValue(false),
    listRecentStartedForActor: vi.fn().mockResolvedValue(
      (options.started ?? [OWN_SID]).map((id) => ({
        aggregateId: id,
        actingLegalEntityId: ENTITY,
      })),
    ),
  } as unknown as IImpersonationDomainEventReader;
  const service = new ImpersonationAuditService(
    { runInTransaction: (fn: (tx: unknown) => unknown) => fn({}) } as unknown as ITransactionRunner,
    reader,
    { withTx: () => ({ publish }) } as unknown as IDomainEventSink,
    sessions as never,
  );
  return { service, publish, endForActor };
}

const ownRow = (id: string): SessionRow => ({
  id,
  actorUserId: "a",
  targetLegalEntityId: ENTITY,
  endedAt: null,
});

const cookie = (sid: string) =>
  `lax_acting_legal_entity_id=${encodeActingContextCookie({ v: 1, e: ENTITY, i: { sid } })}`;

describe("ImpersonationAuditService.reconcileFromAdminRequestCookie", () => {
  it("records nothing while the cookie holds one of the actor's live sessions", async () => {
    const { service, publish, endForActor } = setup({ live: [OWN_SID] });
    await service.reconcileFromAdminRequestCookie({
      actorUserId: "a",
      cookieHeader: cookie(OWN_SID),
    });
    expect(publish).not.toHaveBeenCalled();
    expect(endForActor).not.toHaveBeenCalled();
  });

  it("ends a session that is not live and records the cleared cookie when there is none", async () => {
    const { service, publish, endForActor } = setup({ live: [], rows: [ownRow(OWN_SID)] });
    await service.reconcileFromAdminRequestCookie({ actorUserId: "a", cookieHeader: undefined });
    expect(endForActor).toHaveBeenCalledWith(OWN_SID, "a", "cookie_cleared_after_failed_end");
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish.mock.calls[0]?.[0].payload.end_reason).toBe("cookie_cleared_after_failed_end");
  });

  it("leaves a live session alone when this browser has no cookie (another browser holds it)", async () => {
    const { service, publish, endForActor } = setup({ live: [OWN_SID], rows: [ownRow(OWN_SID)] });
    await service.reconcileFromAdminRequestCookie({ actorUserId: "a", cookieHeader: undefined });
    expect(endForActor).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it("ends the actor's own expired session as a timeout, not as a cleared cookie", async () => {
    const { service, publish, endForActor } = setup({
      live: [],
      rows: [ownRow(EXPIRED_SID)],
      started: [EXPIRED_SID],
    });
    await service.reconcileFromAdminRequestCookie({
      actorUserId: "a",
      cookieHeader: cookie(EXPIRED_SID),
    });
    expect(endForActor).toHaveBeenCalledTimes(1);
    expect(endForActor).toHaveBeenCalledWith(EXPIRED_SID, "a", "timeout");
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish.mock.calls[0]?.[0].payload.end_reason).toBe("timeout");
    expect(publish.mock.calls[0]?.[0].actingLegalEntityId).toBe(ENTITY);
  });

  it("a foreign or stale session id does not hide a cleared cookie", async () => {
    const { service, publish } = setup({ live: [OWN_SID], rows: [ownRow(OWN_SID)] });
    await service.reconcileFromAdminRequestCookie({
      actorUserId: "a",
      cookieHeader: cookie(FOREIGN_SID),
    });
    // OWN_SID is live, so nothing is ended on another browser's behalf.
    expect(publish).not.toHaveBeenCalled();
  });

  it("a foreign session id never ends another actor's session", async () => {
    const foreign: SessionRow = { ...ownRow(FOREIGN_SID), actorUserId: "someone-else" };
    const { service, publish } = setup({ live: [], rows: [foreign], started: [] });
    await service.reconcileFromAdminRequestCookie({
      actorUserId: "a",
      cookieHeader: cookie(FOREIGN_SID),
    });
    expect(foreign.endedAt).toBeNull();
    expect(publish).not.toHaveBeenCalled();
  });

  it("records nothing when the session row is already ended", async () => {
    const ended: SessionRow = { ...ownRow(OWN_SID), endedAt: new Date() };
    const { service, publish } = setup({ live: [], rows: [ended] });
    await service.reconcileFromAdminRequestCookie({ actorUserId: "a", cookieHeader: undefined });
    expect(publish).not.toHaveBeenCalled();
  });
});
