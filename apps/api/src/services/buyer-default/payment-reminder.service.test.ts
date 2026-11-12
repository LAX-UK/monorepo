import { InvoiceRecipients } from "@auction/finance-runtime";
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
    dueAt: null,
    fulfilmentStatus: "awaiting_payment",
    sentSteps: [],
    ...over,
  };
}

function setup(
  rows: PaymentReminderCandidate[],
  opts: {
    hold?: boolean;
    at: Date;
    payers?: string[];
    eligibility?: import("@auction/domain").PaymentEligibility;
    /** Saved Account zones by person; anyone absent has none. */
    zones?: Record<string, string>;
  },
) {
  const claimed = new Set<string>();
  const store: IPaymentReminderStore = {
    // What the store reports as taken follows what was claimed, as the table does.
    listCandidates: vi.fn(async () =>
      rows.map((row) => ({
        ...row,
        sentSteps: [...claimed]
          .filter((key) => key.startsWith(`${row.paymentId}:`))
          .map((key) => key.split(":")[1] as string),
      })),
    ),
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
  const staged: string[] = [];
  const stagedKeys = new Set<string>();
  const service = new PaymentReminderService({
    store,
    compliance: { peek: vi.fn().mockResolvedValue({ hold: opts.hold ?? false, reason: null }) },
    outbox: {
      stageDispatch: vi.fn(
        async (input: { userId: string; payload: unknown; idempotencyKey: string }) => {
          // The outbox keeps one row per key, so a second staging of the same one is a no-op.
          if (stagedKeys.has(input.idempotencyKey)) return;
          stagedKeys.add(input.idempotencyKey);
          staged.push(input.idempotencyKey);
          await dispatch(input.userId, input.payload);
        },
      ),
    },
    ...(opts.eligibility
      ? { eligibility: { check: vi.fn(async () => opts.eligibility as never) } }
      : {}),
    factory: new NotificationFactory(),
    recipients: new InvoiceRecipients({
      listUserIdsForAudience: vi.fn(async () => opts.payers ?? []),
    }),
    zones: { zonesFor: async () => new Map(Object.entries(opts.zones ?? {})) },
    now: () => opts.at,
  });
  return { service, dispatch, store, staged };
}

describe("PaymentReminderService", () => {
  it("names the stored due date, not one worked out from the payment row", async () => {
    const stored = new Date("2026-11-20T23:59:59.999Z");
    const { service, dispatch } = setup([candidate({ dueAt: stored })], {
      at: new Date("2026-11-20T10:00:00Z"),
    });
    expect(await service.sendDueReminders()).toEqual({ reminded: 1 });
    const [, payload] = dispatch.mock.calls[0] ?? [];
    expect(payload.meta.dueDate).toBe("20 November 2026");
    expect(payload.meta.reminderStep).toBe("due_day");
  });

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

  it("reminds an organisation's payers as well as the winner, each by their own email", async () => {
    const { service, dispatch } = setup([candidate({ buyerId: "agent-1", winnerId: "agent-1" })], {
      at: dueAt,
      payers: ["owner-1", "finance-1", "agent-1"],
    });
    expect(await service.sendDueReminders()).toEqual({ reminded: 1 });
    const sent = dispatch.mock.calls.map(([userId, payload]) => [
      userId,
      payload.meta.emailIdempotencyKey,
    ]);
    expect(sent.map(([userId]) => userId)).toEqual(["agent-1", "owner-1", "finance-1"]);
    expect(new Set(sent.map(([, key]) => key)).size).toBe(3);
  });

  it("stages each person's reminder under their own key, so a retry never repeats it", async () => {
    const { service, staged } = setup([candidate({ buyerId: "agent-1", winnerId: "agent-1" })], {
      at: dueAt,
      payers: ["owner-1"],
    });
    await service.sendDueReminders();
    expect(staged).toEqual([
      `payment_reminder:${candidate().paymentId}:due_day:agent-1`,
      `payment_reminder:${candidate().paymentId}:due_day:owner-1`,
    ]);
  });

  it("a held invoice's reminder says what to do instead of asking for payment", async () => {
    const { service, dispatch } = setup([candidate()], {
      at: dueAt,
      eligibility: { kind: "held", reason: "identity_verification_required" },
    });
    await service.sendDueReminders();
    const [, payload] = dispatch.mock.calls[0] ?? [];
    expect(payload.title).toBe("Verify your identity to pay for Harbour at dusk");
    expect(payload.meta.heldReason).toBe("identity_verification_required");
  });

  it("an organisation under review is told it cannot pay yet, with nothing to do", async () => {
    const { service, dispatch } = setup([candidate()], {
      at: dueAt,
      eligibility: { kind: "held", reason: "organisation_under_review" },
    });
    await service.sendDueReminders();
    const [, payload] = dispatch.mock.calls[0] ?? [];
    expect(payload.message).toContain("cannot be paid yet");
  });

  it("a closed account is not chased for payment", async () => {
    const { service, dispatch } = setup([candidate()], {
      at: dueAt,
      eligibility: { kind: "refused", reason: "organisation_closed" },
    });
    await service.sendDueReminders();
    expect(dispatch).not.toHaveBeenCalled();
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

  it("stages nothing it cannot send, takes no step, and retries on the next run", async () => {
    const { service, dispatch, store } = setup([candidate()], { at: dueAt });
    dispatch.mockRejectedValueOnce(new Error("down"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await service.sendDueReminders()).toEqual({ reminded: 0 });
    expect(store.claim).not.toHaveBeenCalled();
    expect(await service.sendDueReminders()).toEqual({ reminded: 1 });
  });
});

describe("PaymentReminderService reminds each person at 09:00 their time", () => {
  // Due at the end of 20 November (GMT): the due-day reminder is 09:00 London, 20 November.
  const stored = new Date("2026-11-20T23:59:59.999Z");
  const people = {
    payers: ["la-owner", "sydney-finance"],
    zones: {
      "la-owner": "America/Los_Angeles",
      "sydney-finance": "Australia/Sydney",
    },
  };
  const run = (at: string) =>
    setup([candidate({ dueAt: stored, buyerId: "buyer-1" })], { at: new Date(at), ...people });

  it("reminds the person with no saved zone at 09:00 London and waits for the others", async () => {
    const { service, staged, store } = run("2026-11-20T09:30:00Z");
    expect(await service.sendDueReminders()).toEqual({ reminded: 0 });
    expect(staged).toEqual(["payment_reminder:pay-1:due_day:buyer-1"]);
    expect(store.claim).not.toHaveBeenCalled();
  });

  it("reminds a person in Los Angeles at 09:00 there, the same London day", async () => {
    const { service, staged } = run("2026-11-20T17:30:00Z");
    await service.sendDueReminders();
    expect(staged).toContain("payment_reminder:pay-1:due_day:la-owner");
    expect(staged).not.toContain("payment_reminder:pay-1:due_day:sydney-finance");
  });

  it("takes the step once everyone has had theirs, never sending anyone's twice", async () => {
    const options = { at: new Date("2026-11-20T09:30:00Z"), ...people };
    const { service, staged, store } = setup(
      [candidate({ dueAt: stored, buyerId: "buyer-1" })],
      options,
    );
    // The worker polls hourly through the day; the clock moves between runs.
    for (const time of ["09:30", "10:30", "17:30", "18:30", "22:30", "23:30"]) {
      options.at = new Date(`2026-11-20T${time}:00Z`);
      await service.sendDueReminders();
    }
    expect(staged).toEqual([
      "payment_reminder:pay-1:due_day:buyer-1",
      "payment_reminder:pay-1:due_day:la-owner",
      "payment_reminder:pay-1:due_day:sydney-finance",
    ]);
    expect(store.claim).toHaveBeenCalledTimes(1);
    expect(store.claim).toHaveBeenCalledWith("pay-1", "due_day");
  });
});
