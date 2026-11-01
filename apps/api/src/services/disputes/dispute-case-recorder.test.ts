import type { DisputeCandidate } from "@auction/domain";
import type {
  DisputeAllocationRecord,
  DisputeCaseRecord,
  IDisputeCaseRepository,
  IDisputePaymentReader,
  LegacyDisputeLine,
} from "@auction/persistence/interfaces";
import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDomainEventSink } from "../../test/domain-event-sink-mock.js";
import { STRIPE_DISPUTE_FIXTURE } from "../../test/stripe-dispute-fixture.js";
import { DisputeAllocationService } from "./dispute-allocation.service.js";
import { DisputeCaseRecorder } from "./dispute-case-recorder.js";
import { DisputeLineEffects } from "./dispute-line-effects.js";

/** In-memory dispute cases, enough to drive the recorder and the allocation service. */
class FakeDisputeStore implements IDisputeCaseRepository, IDisputePaymentReader {
  cases = new Map<string, DisputeCaseRecord>();
  candidates = new Map<string, string[]>();
  allocations: DisputeAllocationRecord[] = [];
  payments: DisputeCandidate[] = [];
  charges = new Map<string, string[]>();
  legacy: LegacyDisputeLine[] = [];
  private seq = 0;

  async insertOrLockInTransaction(
    _tx: unknown,
    input: Parameters<IDisputeCaseRepository["insertOrLockInTransaction"]>[1],
  ) {
    const existing = await this.lockByStripeIdInTransaction(_tx, input.stripeDisputeId);
    if (existing) return { record: existing, created: false };
    const { snapshot } = input;
    const record: DisputeCaseRecord = {
      id: `case-${++this.seq}`,
      stripeDisputeId: input.stripeDisputeId,
      stripeChargeId: input.stripeChargeId,
      stripePaymentIntentId: input.stripePaymentIntentId,
      amountPence: snapshot.amountPence,
      currency: snapshot.currency,
      reason: snapshot.reason,
      networkReasonCode: snapshot.networkReasonCode,
      cardBrand: snapshot.cardBrand,
      cardLast4: snapshot.cardLast4,
      status: snapshot.status,
      dueBy: snapshot.dueBy,
      evidenceSubmitted: snapshot.evidenceSubmitted,
      chargeRefundable: snapshot.chargeRefundable,
      allocationState: input.allocationState,
      fundsWithdrawnAt: input.fundsWithdrawnAt,
      fundsReinstatedAt: input.fundsReinstatedAt,
      stripeCreatedAt: input.stripeCreatedAt,
      lastEventAt: snapshot.eventAt,
      closedAt: snapshot.closedAt,
      version: 1,
    };
    this.cases.set(record.id, record);
    this.candidates.set(record.id, [...input.candidatePaymentIds]);
    return { record: { ...record }, created: true };
  }
  async lockByStripeIdInTransaction(_tx: unknown, stripeDisputeId: string) {
    const found = [...this.cases.values()].find((c) => c.stripeDisputeId === stripeDisputeId);
    return found ? { ...found } : null;
  }
  async lockByIdInTransaction(_tx: unknown, caseId: string) {
    const found = this.cases.get(caseId);
    return found ? { ...found } : null;
  }
  async applySnapshotInTransaction(
    _tx: unknown,
    caseId: string,
    s: Parameters<IDisputeCaseRepository["applySnapshotInTransaction"]>[2],
  ) {
    const c = this.cases.get(caseId) as DisputeCaseRecord;
    Object.assign(c, {
      status: s.status,
      amountPence: s.amountPence,
      dueBy: s.dueBy,
      evidenceSubmitted: s.evidenceSubmitted,
      lastEventAt: s.eventAt,
      closedAt: s.closedAt,
    });
  }
  async recordFundsInTransaction(
    _tx: unknown,
    caseId: string,
    funds: { fundsWithdrawnAt: Date | null; fundsReinstatedAt: Date | null },
  ) {
    Object.assign(this.cases.get(caseId) as DisputeCaseRecord, funds);
  }
  async markAllocatedInTransaction(_tx: unknown, caseId: string, expectedVersion: number) {
    const c = this.cases.get(caseId) as DisputeCaseRecord;
    if (c.version !== expectedVersion) return false;
    c.allocationState = "allocated";
    c.version += 1;
    return true;
  }
  async listCandidatePaymentIdsInTransaction(_tx: unknown, caseId: string) {
    return this.candidates.get(caseId) ?? [];
  }
  async listAllocationsInTransaction(_tx: unknown, caseId: string) {
    return this.allocations.filter((a) => a.caseId === caseId).map((a) => ({ ...a }));
  }
  async insertAllocationsInTransaction(
    _tx: unknown,
    caseId: string,
    lines: Parameters<IDisputeCaseRepository["insertAllocationsInTransaction"]>[2],
  ) {
    const rows = lines.map((l) => ({
      id: `line-${++this.seq}`,
      caseId,
      paymentId: l.paymentId,
      sellerLegalEntityId: l.sellerLegalEntityId,
      amountPence: l.amountPence,
      sellerSharePence: l.sellerSharePence,
      clawback: l.clawback,
      source: l.source,
    }));
    this.allocations.push(...rows);
    return rows.map((r) => ({ ...r }));
  }
  async setClawbackInTransaction(
    _tx: unknown,
    allocationId: string,
    clawback: DisputeAllocationRecord["clawback"],
  ) {
    (this.allocations.find((a) => a.id === allocationId) as DisputeAllocationRecord).clawback =
      clawback;
  }
  async listByChargeInTransaction(_tx: unknown, refs: { chargeId: string }) {
    const ids = this.charges.get(refs.chargeId) ?? [];
    return this.payments.filter((p) => ids.includes(p.paymentId));
  }
  async findByIdsInTransaction(_tx: unknown, ids: readonly string[]) {
    return this.payments.filter((p) => ids.includes(p.paymentId));
  }
  async legacyLinesInTransaction() {
    return this.legacy;
  }
}

const invoice = (
  paymentId: string,
  amountPence: number,
  platformFeePence = 0,
): DisputeCandidate => ({
  paymentId,
  sellerLegalEntityId: `seller-${paymentId}`,
  amountPence,
  platformFeePence,
});

function setup() {
  const store = new FakeDisputeStore();
  const publish = vi.fn().mockResolvedValue(undefined);
  const events = mockDomainEventSink(publish);
  const addLine = vi.fn().mockResolvedValue(undefined);
  const claimed = new Set<string>();
  const transactionRunner = {
    runInTransaction: <T>(fn: (tx: never) => Promise<T>) => fn({} as never),
  };
  const effects = new DisputeLineEffects({
    cases: store,
    payoutAdjustments: { addPaymentLineToOpenPayoutOrCreateClawback: addLine },
    events,
  });
  const recorder = new DisputeCaseRecorder({
    transactionRunner,
    claims: {
      claim: async (_tx, id) => {
        if (claimed.has(id)) return false;
        claimed.add(id);
        return true;
      },
    },
    cases: store,
    payments: store,
    effects,
    events,
    now: () => new Date("2026-11-01T12:00:00Z"),
  });
  const allocation = new DisputeAllocationService({
    transactionRunner,
    cases: store,
    payments: store,
    effects,
    events,
  });
  let n = 0;
  const event = (type: string, created = 1_798_000_000 + n) =>
    ({ id: `evt_${++n}`, type, created }) as unknown as Stripe.Event;
  const eventTypes = () => publish.mock.calls.map(([e]) => e.eventType);
  return { store, publish, addLine, recorder, allocation, event, eventTypes };
}

const dispute = (over: Partial<Stripe.Dispute> = {}) =>
  ({ ...STRIPE_DISPUTE_FIXTURE, amount: 20_000, ...over }) as Stripe.Dispute;

describe("DisputeCaseRecorder", () => {
  let t: ReturnType<typeof setup>;
  beforeEach(() => {
    t = setup();
  });

  it("records a dispute no payment matches, for the finance team, moving no money", async () => {
    const result = await t.recorder.record("created", t.event("charge.dispute.created"), dispute());

    expect(result).toEqual({
      processed: true,
      action: "dispute_created",
      reason: "needs_allocation",
    });
    const [record] = [...t.store.cases.values()];
    expect(record).toMatchObject({
      stripeDisputeId: STRIPE_DISPUTE_FIXTURE.id,
      stripeChargeId: "ch_fixture",
      amountPence: 20_000,
      currency: "gbp",
      reason: "fraudulent",
      networkReasonCode: "10.4",
      status: "needs_response",
      dueBy: new Date(1_798_950_000 * 1000),
      allocationState: "needs_allocation",
    });
    expect(t.eventTypes()).toEqual(["dispute_case.needs_allocation"]);

    await t.recorder.record(
      "funds_withdrawn",
      t.event("charge.dispute.funds_withdrawn"),
      dispute(),
    );
    expect(t.addLine).not.toHaveBeenCalled();
  });

  it("records each dispute once, however many times Stripe sends the same event", async () => {
    const created = t.event("charge.dispute.created");
    await t.recorder.record("created", created, dispute());
    expect(await t.recorder.record("created", created, dispute())).toMatchObject({
      reason: "duplicate_event",
    });
    await t.recorder.record("updated", t.event("charge.dispute.updated"), dispute());
    expect(t.store.cases.size).toBe(1);
  });

  it("keeps today's single-invoice clawback and reversal", async () => {
    t.store.payments = [invoice("pay_1", 20_000, 1_000)];
    t.store.charges.set("ch_fixture", ["pay_1"]);

    expect(
      await t.recorder.record("created", t.event("charge.dispute.created"), dispute()),
    ).toEqual({
      processed: true,
      action: "dispute_created",
    });
    await t.recorder.record(
      "funds_withdrawn",
      t.event("charge.dispute.funds_withdrawn"),
      dispute(),
    );
    expect(t.addLine).toHaveBeenCalledWith(
      expect.objectContaining({
        legalEntityId: "seller-pay_1",
        paymentId: "pay_1",
        amount: "-200.00",
        kind: "dispute",
      }),
    );

    await t.recorder.record("closed", t.event("charge.dispute.closed"), dispute({ status: "won" }));
    expect(t.addLine).toHaveBeenLastCalledWith(
      expect.objectContaining({ paymentId: "pay_1", amount: "200.00" }),
    );
    expect(t.eventTypes()).toEqual([
      "payment.dispute_opened",
      "payment.dispute_funds_withdrawn",
      "payment.dispute_closed",
    ]);
  });

  it("does not claw back on a loss; that happened when the funds were withdrawn", async () => {
    t.store.payments = [invoice("pay_1", 20_000)];
    t.store.charges.set("ch_fixture", ["pay_1"]);
    await t.recorder.record(
      "closed",
      t.event("charge.dispute.closed"),
      dispute({ status: "lost" }),
    );
    expect(t.addLine).not.toHaveBeenCalled();
    expect(t.eventTypes()).toContain("payment.dispute_closed");
  });

  it("reverses once when Stripe sends both funds reinstated and closed as won", async () => {
    t.store.payments = [invoice("pay_1", 20_000)];
    t.store.charges.set("ch_fixture", ["pay_1"]);
    await t.recorder.record(
      "funds_withdrawn",
      t.event("charge.dispute.funds_withdrawn"),
      dispute(),
    );
    const won = dispute({ status: "won" });
    expect(
      await t.recorder.record("funds_reinstated", t.event("charge.dispute.funds_reinstated"), won),
    ).toEqual({ processed: true, action: "dispute_funds_reinstated" });
    await t.recorder.record("closed", t.event("charge.dispute.closed"), won);
    expect(t.addLine.mock.calls.map(([c]) => c.amount)).toEqual(["-200.00", "200.00"]);
  });

  it("never charges a seller for a won dispute whose withdrawal arrives late", async () => {
    t.store.payments = [invoice("pay_1", 20_000)];
    t.store.charges.set("ch_fixture", ["pay_1"]);
    await t.recorder.record("closed", t.event("charge.dispute.closed"), dispute({ status: "won" }));
    await t.recorder.record(
      "funds_withdrawn",
      t.event("charge.dispute.funds_withdrawn", 1),
      dispute(),
    );
    expect(t.addLine).not.toHaveBeenCalled();
  });

  it("links every invoice of a shared charge and moves no money until it is allocated", async () => {
    t.store.payments = [invoice("a", 10_000, 500), invoice("b", 10_000, 500)];
    t.store.charges.set("ch_fixture", ["a", "b"]);

    await t.recorder.record("created", t.event("charge.dispute.created"), dispute());
    await t.recorder.record(
      "funds_withdrawn",
      t.event("charge.dispute.funds_withdrawn"),
      dispute(),
    );
    const [record] = [...t.store.cases.values()];
    expect(record?.allocationState).toBe("needs_allocation");
    expect(t.store.candidates.get(record?.id as string)).toEqual(["a", "b"]);
    expect(t.addLine).not.toHaveBeenCalled();
    expect(t.eventTypes()).toEqual(["dispute_case.needs_allocation"]);
  });

  it("keeps the newest deadline and status when an older update arrives late", async () => {
    await t.recorder.record(
      "updated",
      t.event("charge.dispute.updated", 1_798_000_500),
      dispute({
        status: "under_review",
        evidence_details: { ...STRIPE_DISPUTE_FIXTURE.evidence_details, due_by: 1_799_000_000 },
      }),
    );
    await t.recorder.record("created", t.event("charge.dispute.created", 1_798_000_000), dispute());
    expect([...t.store.cases.values()][0]).toMatchObject({
      status: "under_review",
      dueBy: new Date(1_799_000_000 * 1000),
    });
  });

  it("rebuilds a dispute opened before cases existed from what the ledger holds", async () => {
    t.store.legacy = [
      {
        paymentId: "pay_1",
        sellerLegalEntityId: "seller-pay_1",
        amountPence: 20_000,
        sellerSharePence: 20_000,
        clawback: "withdrawn",
      },
    ];
    await t.recorder.record("closed", t.event("charge.dispute.closed"), dispute({ status: "won" }));
    // The old code already clawed back; winning now reverses it once, and nothing is re-announced.
    expect(t.addLine.mock.calls.map(([c]) => c.amount)).toEqual(["200.00"]);
    expect(t.eventTypes()).toEqual(["payment.dispute_closed"]);
  });

  it("asks Stripe to retry a dispute without a charge", async () => {
    expect(
      await t.recorder.record(
        "created",
        t.event("charge.dispute.created"),
        dispute({ charge: null as never }),
      ),
    ).toEqual({ processed: false, reason: "missing_charge_id" });
  });
});

describe("DisputeAllocationService", () => {
  let t: ReturnType<typeof setup>;
  beforeEach(async () => {
    t = setup();
    t.store.payments = [invoice("a", 10_000, 2_000), invoice("b", 10_000, 0), invoice("z", 50_000)];
    t.store.charges.set("ch_fixture", ["a", "b"]);
    await t.recorder.record(
      "created",
      t.event("charge.dispute.created"),
      dispute({ amount: 15_000 }),
    );
    t.publish.mockClear();
  });
  const caseOf = (store: FakeDisputeStore) => [...store.cases.values()][0] as DisputeCaseRecord;

  it("allocates across the invoices and holds payouts while the funds have not moved", async () => {
    const record = caseOf(t.store);
    const result = await t.allocation.allocate({
      caseId: record.id,
      expectedVersion: 1,
      actorUserId: "staff-1",
      lines: [
        { paymentId: "a", amountPence: 5_000 },
        { paymentId: "b", amountPence: 10_000 },
      ],
    });
    expect(result._unsafeUnwrap()).toEqual({ caseId: record.id, version: 2 });
    expect(t.addLine).not.toHaveBeenCalled();
    expect(t.eventTypes()).toEqual([
      "payment.dispute_opened",
      "payment.dispute_opened",
      "dispute_case.allocated",
    ]);
    expect(t.publish).toHaveBeenLastCalledWith(expect.objectContaining({ actorUserId: "staff-1" }));

    // Withdrawn later: each seller carries their share of their line only.
    await t.recorder.record(
      "funds_withdrawn",
      t.event("charge.dispute.funds_withdrawn"),
      dispute({ amount: 15_000 }),
    );
    expect(t.addLine.mock.calls.map(([c]) => [c.paymentId, c.legalEntityId, c.amount])).toEqual([
      ["a", "seller-a", "-40.00"],
      ["b", "seller-b", "-100.00"],
    ]);
  });

  it("catches up with funds already withdrawn, and a case already closed", async () => {
    await t.recorder.record(
      "funds_withdrawn",
      t.event("charge.dispute.funds_withdrawn"),
      dispute({ amount: 15_000 }),
    );
    await t.recorder.record(
      "closed",
      t.event("charge.dispute.closed"),
      dispute({ amount: 15_000, status: "lost" }),
    );
    expect(t.addLine).not.toHaveBeenCalled();
    t.publish.mockClear();

    const record = caseOf(t.store);
    await t.allocation.allocate({
      caseId: record.id,
      expectedVersion: 1,
      actorUserId: "staff-1",
      lines: [
        { paymentId: "b", amountPence: 10_000 },
        { paymentId: "a", amountPence: 5_000 },
      ],
    });
    expect(t.addLine.mock.calls.map(([c]) => c.amount)).toEqual(["-100.00", "-40.00"]);
    expect(t.eventTypes()).toEqual([
      "payment.dispute_opened",
      "payment.dispute_opened",
      "payment.dispute_funds_withdrawn",
      "payment.dispute_funds_withdrawn",
      "payment.dispute_closed",
      "payment.dispute_closed",
      "dispute_case.allocated",
    ]);
  });

  it("refuses a stale version, a second allocation and an invalid one", async () => {
    const record = caseOf(t.store);
    const lines = [
      { paymentId: "b", amountPence: 10_000 },
      { paymentId: "a", amountPence: 5_000 },
    ];
    expect(
      (
        await t.allocation.allocate({
          caseId: record.id,
          expectedVersion: 7,
          actorUserId: "s",
          lines,
        })
      )._unsafeUnwrapErr(),
    ).toBe("version_conflict");
    expect(
      (
        await t.allocation.allocate({
          caseId: record.id,
          expectedVersion: 1,
          actorUserId: "s",
          lines: [{ paymentId: "z", amountPence: 15_000 }],
        })
      )._unsafeUnwrapErr(),
    ).toBe("not_a_candidate");
    expect(
      (
        await t.allocation.allocate({
          caseId: record.id,
          expectedVersion: 1,
          actorUserId: "s",
          lines,
        })
      )._unsafeUnwrap().version,
    ).toBe(2);
    expect(
      (
        await t.allocation.allocate({
          caseId: record.id,
          expectedVersion: 2,
          actorUserId: "s",
          lines,
        })
      )._unsafeUnwrapErr(),
    ).toBe("already_allocated");
    expect(
      (
        await t.allocation.allocate({ caseId: "nope", expectedVersion: 1, actorUserId: "s", lines })
      )._unsafeUnwrapErr(),
    ).toBe("not_found");
  });
});
