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

function setup(activeIds: string[]) {
  const publish = vi.fn().mockResolvedValue(undefined);
  const reader = {
    findStartedEvent: vi.fn(),
    hasEndedEvent: vi.fn().mockResolvedValue(false),
    listRecentStartedForActor: vi
      .fn()
      .mockResolvedValue([{ aggregateId: OWN_SID, actingLegalEntityId: ENTITY }]),
  } as unknown as IImpersonationDomainEventReader;
  const service = new ImpersonationAuditService(
    { runInTransaction: (fn: (tx: unknown) => unknown) => fn({}) } as unknown as ITransactionRunner,
    reader,
    { withTx: () => ({ publish }) } as unknown as IDomainEventSink,
    { listActiveByActor: vi.fn().mockResolvedValue(activeIds.map((id) => ({ id }))) } as never,
  );
  return { service, publish };
}

const cookie = (sid: string) =>
  `lax_acting_legal_entity_id=${encodeActingContextCookie({ v: 1, e: ENTITY, i: { sid } })}`;

describe("ImpersonationAuditService.reconcileFromAdminRequestCookie", () => {
  it("records nothing while the cookie holds one of the actor's live sessions", async () => {
    const { service, publish } = setup([OWN_SID]);
    await service.reconcileFromAdminRequestCookie({
      actorUserId: "a",
      cookieHeader: cookie(OWN_SID),
    });
    expect(publish).not.toHaveBeenCalled();
  });

  it("records a cleared cookie when there is no cookie", async () => {
    const { service, publish } = setup([OWN_SID]);
    await service.reconcileFromAdminRequestCookie({ actorUserId: "a", cookieHeader: undefined });
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it("a foreign or stale session id does not hide a cleared cookie", async () => {
    const { service, publish } = setup([OWN_SID]);
    await service.reconcileFromAdminRequestCookie({
      actorUserId: "a",
      cookieHeader: cookie(FOREIGN_SID),
    });
    expect(publish).toHaveBeenCalledTimes(1);
  });
});
