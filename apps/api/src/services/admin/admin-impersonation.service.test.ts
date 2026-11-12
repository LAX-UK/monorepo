import type {
  IImpersonationDomainEventReader,
  IImpersonationSessionRepository,
  ILegalEntityRepository,
  ITransactionRunner,
  ImpersonationSessionRow,
} from "@auction/persistence/interfaces";
import { encodeActingContextCookie } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import type { IDomainEventSink } from "../domain-event-sink.js";
import { AdminImpersonationService } from "./admin-impersonation.service.js";

const ACTOR = "actor-1";
const SID = "22222222-2222-4222-8222-222222222222";
const REAL_TARGET = "11111111-1111-4111-8111-111111111111";
const FORGED_E = "99999999-9999-4999-8999-999999999999";

function setup(row: Partial<ImpersonationSessionRow> | null) {
  const publish = vi.fn().mockResolvedValue(undefined);
  const sessions = {
    forConnection: vi.fn(),
    start: vi.fn().mockResolvedValue({ id: "new", expiresAt: new Date() }),
    end: vi.fn(),
    endForActor: vi.fn().mockResolvedValue(true),
    findById: vi.fn().mockResolvedValue(
      row && {
        id: SID,
        actorUserId: ACTOR,
        targetLegalEntityId: REAL_TARGET,
        endedAt: null,
        ...row,
      },
    ),
    findActive: vi.fn(),
    listActiveByActor: vi.fn(),
  };
  sessions.forConnection.mockReturnValue(sessions);
  const runner = {
    runInTransaction: (fn: (tx: unknown) => unknown) => fn({}),
  } as unknown as ITransactionRunner;
  const sink = { withTx: () => ({ publish }) } as unknown as IDomainEventSink;
  const legalEntities = {
    findActiveMembership: vi.fn().mockResolvedValue(null),
    findById: vi
      .fn()
      .mockResolvedValue({ id: REAL_TARGET, displayName: "Acme", status: "approved" }),
  } as unknown as ILegalEntityRepository;
  const service = new AdminImpersonationService(
    runner,
    legalEntities,
    sessions as unknown as IImpersonationSessionRepository,
    {} as IImpersonationDomainEventReader,
    sink,
  );
  return { service, sessions, publish };
}

const cookie = (e: string) =>
  `lax_acting_legal_entity_id=${encodeActingContextCookie({ v: 1, e, i: { sid: SID } })}`;

describe("AdminImpersonationService.endImpersonation", () => {
  it("ends the actor's own session and audits the session's real entity, not the cookie's", async () => {
    const { service, sessions, publish } = setup({});
    const result = await service.endImpersonation({
      actorUserId: ACTOR,
      cookieHeader: cookie(FORGED_E),
    });
    expect(result).toEqual({ ok: true });
    expect(sessions.endForActor).toHaveBeenCalledWith(SID, ACTOR, "manual");
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ actingLegalEntityId: REAL_TARGET, actorUserId: ACTOR }),
    );
  });

  it("refuses another staff member's session", async () => {
    const { service, sessions, publish } = setup({ actorUserId: "someone-else" });
    const result = await service.endImpersonation({
      actorUserId: ACTOR,
      cookieHeader: cookie(REAL_TARGET),
    });
    expect(result).toEqual({ ok: false, error: "no_active_impersonation" });
    expect(sessions.endForActor).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it("refuses an unknown or already ended session", async () => {
    for (const row of [null, { endedAt: new Date() }]) {
      const { service, publish } = setup(row);
      const result = await service.endImpersonation({
        actorUserId: ACTOR,
        cookieHeader: cookie(REAL_TARGET),
      });
      expect(result).toEqual({ ok: false, error: "no_active_impersonation" });
      expect(publish).not.toHaveBeenCalled();
    }
  });
});

describe("AdminImpersonationService.startImpersonation replacing a session", () => {
  it("does not end a session the actor does not own, and still starts the new one", async () => {
    const { service, sessions, publish } = setup({ actorUserId: "someone-else" });
    const result = await service.startImpersonation({
      actorUserId: ACTOR,
      legalEntityId: REAL_TARGET,
      cookieHeader: cookie(FORGED_E),
    });
    expect(result.ok).toBe(true);
    expect(sessions.endForActor).not.toHaveBeenCalled();
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "admin.impersonation_started" }),
    );
  });

  it("replaces the actor's own session, auditing its real entity", async () => {
    const { service, publish } = setup({});
    await service.startImpersonation({
      actorUserId: ACTOR,
      legalEntityId: REAL_TARGET,
      cookieHeader: cookie(FORGED_E),
    });
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "admin.impersonation_ended",
        actingLegalEntityId: REAL_TARGET,
      }),
    );
  });
});
