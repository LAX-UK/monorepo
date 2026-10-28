import { DrizzleLegalEntityLifecycleAdminRepository } from "@auction/persistence/repositories";
import { describe, expect, it, vi } from "vitest";
import { mockDomainEventSink } from "../test/domain-event-sink-mock.js";
import { transactionRunnerFromDb } from "../test/transaction-runner-from-db.js";
import { LegalEntityLifecycleAdminService } from "./legal-entity-lifecycle-admin.service.js";

const entityId = "00000000-0000-4000-8000-000000000001";

const readyConnect = {
  stripeConnectAccountId: "acct_1",
  stripeConnectChargesEnabled: true,
  stripeConnectPayoutsEnabled: true,
  stripeConnectRequirementsCurrentlyDue: [] as string[],
  stripeConnectRequirementsErrors: [] as unknown[],
  stripeConnectDisabledReason: null as string | null,
  isLaxManaged: false,
};

function build(row: Record<string, unknown>) {
  const txHandle = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          for: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([row]) }),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    }),
  };
  const db = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([row]) }),
      }),
    }),
    transaction: vi.fn(async (fn: (tx: typeof txHandle) => Promise<unknown>) => fn(txHandle)),
  };
  const publish = vi.fn().mockResolvedValue(undefined);
  const svc = new LegalEntityLifecycleAdminService(
    transactionRunnerFromDb(db as never),
    new DrizzleLegalEntityLifecycleAdminRepository(db as never),
    mockDomainEventSink(publish) as never,
  );
  return { svc, db, publish };
}

describe("LegalEntityLifecycleAdminService lift_restriction", () => {
  it("returns to approved and records the event when Connect is ready", async () => {
    const { svc, publish } = build({ id: entityId, status: "restricted", ...readyConnect });
    const result = await svc.runTransition("actor-1", entityId, "lift_restriction", " Cleared ");
    expect(result._unsafeUnwrap()).toEqual({ id: entityId, status: "approved" });
    const event = publish.mock.calls[0]?.[0] as {
      eventType: string;
      payload: Record<string, unknown>;
    };
    expect(event.eventType).toBe("legal_entity.restriction_lifted");
    expect(event.payload).toEqual({
      from_status: "restricted",
      to_status: "approved",
      reason: "Cleared",
    });
  });

  it("treats a LAX-managed entity as ready, as the Connect promoter does", async () => {
    const { svc } = build({
      id: entityId,
      status: "restricted",
      ...readyConnect,
      stripeConnectPayoutsEnabled: false,
      isLaxManaged: true,
    });
    const result = await svc.runTransition("actor-1", entityId, "lift_restriction", "Cleared");
    expect(result._unsafeUnwrap().status).toBe("approved");
  });

  it.each([
    ["payouts are off", { stripeConnectPayoutsEnabled: false }],
    ["a requirement is due", { stripeConnectRequirementsCurrentlyDue: ["individual.dob"] }],
    ["Stripe disabled the account", { stripeConnectDisabledReason: "rejected.fraud" }],
  ])("moves to connect_pending when %s", async (_label, patch) => {
    const { svc, publish } = build({
      id: entityId,
      status: "restricted",
      ...readyConnect,
      ...patch,
    });
    const result = await svc.runTransition("actor-1", entityId, "lift_restriction", "Cleared");
    expect(result._unsafeUnwrap().status).toBe("connect_pending");
    const event = publish.mock.calls[0]?.[0] as { payload: { to_status: string } };
    expect(event.payload.to_status).toBe("connect_pending");
  });

  it("requires a reason before opening a transaction", async () => {
    const { svc, db } = build({ id: entityId, status: "restricted", ...readyConnect });
    const result = await svc.runTransition("actor-1", entityId, "lift_restriction", " ");
    expect(result._unsafeUnwrapErr()).toMatchObject({ code: "reason_required", status: 400 });
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("is refused from any status other than restricted", async () => {
    const { svc, db, publish } = build({ id: entityId, status: "approved", ...readyConnect });
    const result = await svc.runTransition("actor-1", entityId, "lift_restriction", "Cleared");
    expect(result._unsafeUnwrapErr()).toMatchObject({ code: "invalid_transition", status: 422 });
    expect(db.transaction).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });
});
