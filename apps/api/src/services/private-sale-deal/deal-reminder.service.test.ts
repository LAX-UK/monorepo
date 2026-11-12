import type { DealReminderCandidate } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { DealReminderService } from "./deal-reminder.service.js";

// Due at the end of 20 November (London, GMT); the due-day reminder is 09:00 that day.
const dueAt = new Date("2026-11-20T23:59:59.999Z");
const dueDay = new Date("2026-11-20T09:00:00Z");

const candidate = (over: Partial<DealReminderCandidate> = {}): DealReminderCandidate => ({
  dealId: "deal-1",
  reference: "PS-0001",
  stage: "invoiced",
  kind: "payment",
  dueAt,
  buyerLegalEntityId: "le-buyer",
  buyerUserId: "u-buyer",
  workTitle: "Harbour at dusk",
  amountDueMinor: 4_800_000,
  sentSteps: [],
  ...over,
});

function setup(
  candidates: DealReminderCandidate[],
  over: {
    hold?: boolean;
    eligibility?: unknown;
    fail?: boolean;
    /** Saved Account zones by person. */
    zones?: [string, string][];
    at?: Date;
  } = {},
) {
  const claimed = new Set<string>();
  const store = {
    listCandidates: async () => candidates,
    claim: vi.fn(async (dealId: string, kind: string, step: string) => {
      const key = `${dealId}:${kind}:${step}`;
      if (claimed.has(key)) return false;
      claimed.add(key);
      return true;
    }),
    release: vi.fn(async () => undefined),
  };
  const stageDispatch = vi.fn(async (_input: { idempotencyKey: string }) => {
    if (over.fail) throw new Error("outbox down");
  });
  const createPaymentReminder = vi.fn((input: Record<string, unknown>) => ({
    type: "payment_reminder",
    ...input,
  }));
  const createDealCollectionReminder = vi.fn((input: Record<string, unknown>) => ({
    type: "lot_ready_for_collection",
    ...input,
  }));
  const service = new DealReminderService({
    store,
    compliance: { peek: async () => ({ hold: over.hold ?? false }) } as never,
    outbox: { stageDispatch },
    factory: { createPaymentReminder, createDealCollectionReminder } as never,
    recipients: { forInvoice: async () => ["u-buyer", "u-payer"] } as never,
    ...(over.eligibility ? { eligibility: { check: async () => over.eligibility } as never } : {}),
    zones: { zonesFor: async () => new Map<string, string>(over.zones ?? []) },
    now: () => over.at ?? dueDay,
  });
  return { service, store, stageDispatch, createPaymentReminder, createDealCollectionReminder };
}

describe("DealReminderService", () => {
  it("reminds every payer of an unpaid deal on the due day, with the amount in pounds", async () => {
    const { service, stageDispatch, createPaymentReminder } = setup([candidate()]);
    expect(await service.sendDueReminders()).toEqual({ reminded: 1 });
    expect(createPaymentReminder).toHaveBeenCalledWith(
      expect.objectContaining({
        lotId: null,
        lotTitle: "Harbour at dusk",
        paymentId: "deal-1",
        amount: "48000.00",
        dueDate: "20 November 2026",
        step: "due_day",
        privateSale: true,
        held: null,
      }),
    );
    expect(stageDispatch).toHaveBeenCalledTimes(2);
    expect(stageDispatch.mock.calls.map(([call]) => call.idempotencyKey)).toEqual([
      "private_sale_payment_reminder:deal-1:due_day:u-buyer",
      "private_sale_payment_reminder:deal-1:due_day:u-payer",
    ]);
  });

  it("reminds a paid buyer to collect the work", async () => {
    const { service, createDealCollectionReminder, createPaymentReminder } = setup([
      candidate({ kind: "collection", stage: "paid" }),
    ]);
    expect(await service.sendDueReminders()).toEqual({ reminded: 1 });
    expect(createDealCollectionReminder).toHaveBeenCalledWith(
      expect.objectContaining({ dealId: "deal-1", workTitle: "Harbour at dusk", step: "due_day" }),
    );
    expect(createPaymentReminder).not.toHaveBeenCalled();
  });

  it("sends each step once, however often it runs", async () => {
    const { service } = setup([candidate()]);
    expect(await service.sendDueReminders()).toEqual({ reminded: 1 });
    expect(await service.sendDueReminders()).toEqual({ reminded: 0 });
  });

  it("sends nothing before the first step, for a deal that moved on or one with nothing owed", async () => {
    const early = setup([candidate({ dueAt: new Date("2026-12-31T23:59:59Z") })]);
    expect(await early.service.sendDueReminders()).toEqual({ reminded: 0 });
    const moved = setup([candidate({ stage: "paid" })]);
    expect(await moved.service.sendDueReminders()).toEqual({ reminded: 0 });
    const nothing = setup([candidate({ amountDueMinor: null })]);
    expect(await nothing.service.sendDueReminders()).toEqual({ reminded: 0 });
  });

  it("does not chase a buyer held for LAX's own checks, or a closed account, for payment", async () => {
    const held = setup([candidate()], { hold: true });
    expect(await held.service.sendDueReminders()).toEqual({ reminded: 0 });
    expect(held.store.claim).not.toHaveBeenCalled();
    const closed = setup([candidate()], { eligibility: { kind: "refused" } });
    expect(await closed.service.sendDueReminders()).toEqual({ reminded: 0 });
  });

  it("tells a buyer who cannot pay yet what to do instead", async () => {
    const { service, createPaymentReminder } = setup([candidate()], {
      eligibility: { kind: "held", reason: "identity_verification_required" },
    });
    await service.sendDueReminders();
    expect(createPaymentReminder).toHaveBeenCalledWith(
      expect.objectContaining({ held: "identity_verification_required" }),
    );
  });

  it("takes no payment step when the send fails, so the next run tries again", async () => {
    const { service, store } = setup([candidate()], { fail: true });
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await service.sendDueReminders()).toEqual({ reminded: 0 });
    quiet.mockRestore();
    expect(store.claim).not.toHaveBeenCalled();
  });

  it("gives a collection step back when its send fails", async () => {
    const { service, store } = setup([candidate({ kind: "collection", stage: "paid" })], {
      fail: true,
    });
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await service.sendDueReminders()).toEqual({ reminded: 0 });
    quiet.mockRestore();
    expect(store.release).toHaveBeenCalledWith("deal-1", "collection", "due_day");
  });

  it("reminds a payer in Sydney at 09:00 their time and the buyer at 09:00 London", async () => {
    const zones: [string, string][] = [["u-payer", "Australia/Sydney"]];
    const london = setup([candidate()], { zones });
    expect(await london.service.sendDueReminders()).toEqual({ reminded: 0 });
    expect(london.stageDispatch.mock.calls.map(([call]) => call.idempotencyKey)).toEqual([
      "private_sale_payment_reminder:deal-1:due_day:u-buyer",
    ]);
    // 09:00 on 21 November in Sydney (UTC+11) is 22:00 on 20 November London.
    const sydney = setup([candidate()], { zones, at: new Date("2026-11-20T22:00:00Z") });
    expect(await sydney.service.sendDueReminders()).toEqual({ reminded: 1 });
    expect(sydney.stageDispatch).toHaveBeenCalledTimes(2);
  });

  it("keeps a collection reminder at 09:00 London whatever zone anyone has saved", async () => {
    const { service, createDealCollectionReminder } = setup(
      [candidate({ kind: "collection", stage: "paid" })],
      { zones: [["u-payer", "Australia/Sydney"]] },
    );
    expect(await service.sendDueReminders()).toEqual({ reminded: 1 });
    expect(createDealCollectionReminder).toHaveBeenCalledTimes(2);
  });
});
