import type { ILegalEntityConnectRepository } from "@auction/persistence";
import { describe, expect, it, vi } from "vitest";
import { ConnectLifecyclePromoter } from "./connect-lifecycle-promoter.js";

function makeConnectRepositoryMocks() {
  const updateStripeConnectFlags = vi.fn().mockResolvedValue(undefined);
  const applyConnectStatusTransition = vi.fn().mockResolvedValue({ id: "e1", status: "approved" });
  const repo = {
    updateStripeConnectFlags,
    applyConnectStatusTransition,
  };
  const connectRepository = {
    forConnection: vi.fn().mockReturnValue(repo),
  } as unknown as ILegalEntityConnectRepository;
  return { connectRepository, updateStripeConnectFlags, applyConnectStatusTransition, repo };
}

function makeDomainEventSink() {
  const publish = vi.fn().mockResolvedValue(undefined);
  return {
    publish,
    withTx: vi.fn().mockReturnValue({ publish }),
  };
}

describe("ConnectLifecyclePromoter", () => {
  it("promotes connect_pending to approved when Stripe account is configured", async () => {
    const domainEventSink = makeDomainEventSink();
    const { connectRepository, applyConnectStatusTransition } = makeConnectRepositoryMocks();
    const promoter = new ConnectLifecyclePromoter(connectRepository, domainEventSink as never);
    const db = {} as never;

    await promoter.applyStripeAccountFlags(
      {
        id: "acct_1",
        charges_enabled: false,
        payouts_enabled: true,
        requirements: { currently_due: [], disabled_reason: null },
      } as never,
      {
        id: "e1",
        kind: "individual",
        status: "connect_pending",
        stripeConnectAccountId: "acct_1",
        isLaxManaged: false,
      } as never,
      db,
    );

    expect(applyConnectStatusTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        legalEntityId: "e1",
        expectedStatus: "connect_pending",
        nextStatus: "approved",
      }),
      db,
    );
    expect(domainEventSink.withTx).toHaveBeenCalledWith(db);
    expect(domainEventSink.withTx(db).publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "legal_entity.lifecycle_progressed",
        payload: expect.objectContaining({ reason: "stripe_connect_ready" }),
      }),
    );
  });

  it("demotes approved to connect_pending when requirements become due", async () => {
    const domainEventSink = makeDomainEventSink();
    const { connectRepository, applyConnectStatusTransition } = makeConnectRepositoryMocks();
    applyConnectStatusTransition.mockResolvedValue({ id: "e1", status: "connect_pending" });
    const promoter = new ConnectLifecyclePromoter(connectRepository, domainEventSink as never);
    const db = {} as never;

    await promoter.applyStripeAccountFlags(
      {
        id: "acct_1",
        charges_enabled: true,
        payouts_enabled: false,
        requirements: {
          currently_due: ["individual.verification.document"],
          disabled_reason: null,
        },
      } as never,
      {
        id: "e1",
        kind: "individual",
        status: "approved",
        stripeConnectAccountId: "acct_1",
        isLaxManaged: false,
      } as never,
      db,
    );

    expect(applyConnectStatusTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        nextStatus: "connect_pending",
        expectedStatus: "approved",
      }),
      db,
    );
    expect(domainEventSink.withTx(db).publish).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ reason: "stripe_connect_requirements_due" }),
      }),
    );
  });

  it("updates flags only when status unchanged", async () => {
    const domainEventSink = makeDomainEventSink();
    const { connectRepository, updateStripeConnectFlags } = makeConnectRepositoryMocks();
    const promoter = new ConnectLifecyclePromoter(connectRepository, domainEventSink as never);
    const db = {} as never;

    await promoter.applyStripeAccountFlags(
      {
        id: "acct_1",
        charges_enabled: true,
        payouts_enabled: true,
        requirements: { currently_due: [], disabled_reason: null },
      } as never,
      {
        id: "e1",
        kind: "individual",
        status: "approved",
        stripeConnectAccountId: "acct_1",
        isLaxManaged: false,
      } as never,
      db,
    );

    expect(updateStripeConnectFlags).toHaveBeenCalled();
    expect(domainEventSink.publish).not.toHaveBeenCalled();
    expect(domainEventSink.withTx).not.toHaveBeenCalled();
  });
});
