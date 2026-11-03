import type {
  IPaymentReminderStore,
  PaymentReminderCandidate,
} from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { NotificationFactory } from "../notification.factory.js";
import { PaymentReminderService } from "./payment-reminder.service.js";

const DAY = 86_400_000;
const raisedAt = new Date("2026-11-01T10:00:00Z");
const dueAt = new Date(raisedAt.getTime() + 7 * DAY);

function candidate(over: Partial<PaymentReminderCandidate> = {}): PaymentReminderCandidate {
  return {
    paymentId: "pay-1",
    lotId: "lot-1",
    lotTitle: "Harbour at dusk",
    lotNumber: 4,
    lotStatus: "ended",
    winnerId: "buyer-1",
    buyerId: "buyer-1",
    buyerLegalEntityId: "ent-1",
    amount: "1200.00",
    paymentStatus: "pending",
    raisedAt,
    fulfilmentStatus: "awaiting_payment",
    sentSteps: [],
    ...over,
  };
}

function setup(rows: PaymentReminderCandidate[], opts: { hold?: boolean; at: Date }) {
  const claimed = new Set<string>();
  const store: IPaymentReminderStore = {
    listCandidates: vi.fn().mockResolvedValue(rows),
    claim: vi.fn(async (id: string, step: string) => {
      const key = `${id}:${step}`;
      if (claimed.has(key)) return false;
      claimed.add(key);
      return true;
    }),
    release: vi.fn(async (id: string, step: string) => {
      claimed.delete(`${id}:${step}`);
    }),
  };
  const dispatch = vi.fn().mockResolvedValue(undefined);
  const service = new PaymentReminderService({
    store,
    compliance: { peek: vi.fn().mockResolvedValue({ hold: opts.hold ?? false, reason: null }) },
    dispatcher: { dispatch },
    factory: new NotificationFactory(),
    now: () => opts.at,
  });
  return { service, dispatch, store };
}

describe("PaymentReminderService", () => {
  it("sends the step that has been reached, with the due date in words", async () => {
    const { service, dispatch } = setup([candidate()], { at: dueAt });
    expect(await service.sendDueReminders()).toEqual({ reminded: 1 });
    const [userId, payload] = dispatch.mock.calls[0] ?? [];
    expect(userId).toBe("buyer-1");
    expect(payload.type).toBe("payment_reminder");
    expect(payload.title).toBe("Payment due today: Harbour at dusk");
    expect(payload.meta.dueDate).toBe("8 November 2026");
    expect(payload.meta.reminderStep).toBe("due_day");
  });

  it("sends each step once however often the cron runs", async () => {
    const { service, dispatch } = setup([candidate()], { at: dueAt });
    await service.sendDueReminders();
    await service.sendDueReminders();
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("sends nothing before the first step", async () => {
    const { service, dispatch } = setup([candidate()], { at: new Date(dueAt.getTime() - 3 * DAY) });
    expect(await service.sendDueReminders()).toEqual({ reminded: 0 });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("pauses while LAX holds the payment, and does not take the step", async () => {
    const { service, dispatch, store } = setup([candidate()], { at: dueAt, hold: true });
    expect(await service.sendDueReminders()).toEqual({ reminded: 0 });
    expect(dispatch).not.toHaveBeenCalled();
    expect(store.claim).not.toHaveBeenCalled();
  });

  it("pauses while the payment itself is in manual review", async () => {
    const { service, dispatch } = setup([candidate({ paymentStatus: "requires_manual_review" })], {
      at: dueAt,
    });
    await service.sendDueReminders();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("never reminds for a cancelled sale", async () => {
    const { service, dispatch } = setup([candidate({ fulfilmentStatus: "cancelled" })], {
      at: dueAt,
    });
    await service.sendDueReminders();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("gives the step back when the notice cannot be sent, so the next run retries", async () => {
    const { service, dispatch, store } = setup([candidate()], { at: dueAt });
    dispatch.mockRejectedValueOnce(new Error("down"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await service.sendDueReminders()).toEqual({ reminded: 0 });
    expect(store.release).toHaveBeenCalledWith("pay-1", "due_day");
    expect(await service.sendDueReminders()).toEqual({ reminded: 1 });
  });
});
