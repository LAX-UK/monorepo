import type { UnappliedMoney } from "@auction/domain";
import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import {
  FakeCheckoutStripe,
  InMemoryCheckoutSessionLedger,
  payOn,
} from "../../test/fake-checkout-stripe.js";
import {
  CheckoutSessionLifecycle,
  isCheckoutSessionUsable,
} from "./stripe-checkout-session-lifecycle.js";
import type { IStripePaymentGateway } from "./stripe-payment-gateway.js";

function setup(recordUnapplied?: (money: UnappliedMoney) => Promise<void>) {
  const stripe = new FakeCheckoutStripe();
  const ledger = new InMemoryCheckoutSessionLedger();
  const report = vi.fn();
  const recordEvent = vi.fn();
  const lifecycle = new CheckoutSessionLifecycle(
    stripe as unknown as IStripePaymentGateway,
    ledger,
    { report },
    recordEvent,
    recordUnapplied ?? null,
  );
  const pay = (rail: "card" | "bank", lines: string[]) => payOn(lifecycle, stripe, rail, lines);
  return { stripe, ledger, report, recordEvent, lifecycle, pay };
}

const readyId = (outcome: Awaited<ReturnType<typeof payOn>>) =>
  outcome.kind === "ready" ? outcome.session.sessionId : outcome.kind;

describe("isCheckoutSessionUsable", () => {
  it("returns true for open sessions with a future expiry", () => {
    expect(
      isCheckoutSessionUsable({
        status: "open",
        url: "https://checkout.stripe.com/pay/cs_1",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      } as Stripe.Checkout.Session),
    ).toBe(true);
  });

  it("returns false for expired open sessions", () => {
    expect(
      isCheckoutSessionUsable({
        status: "open",
        url: "https://checkout.stripe.com/pay/cs_1",
        expires_at: Math.floor(Date.now() / 1000) - 60,
      } as Stripe.Checkout.Session),
    ).toBe(false);
  });
});

describe("CheckoutSessionLifecycle", () => {
  it("repeating an unchanged checkout returns the buyer's open session and closes nothing", async () => {
    const { stripe, pay } = setup();
    const first = readyId(await pay("card", ["lot"]));
    for (let i = 0; i < 6; i += 1) expect(readyId(await pay("card", ["lot"]))).toBe(first);
    expect(stripe.open()).toEqual([first]);
    expect(stripe.sessions.size).toBe(1);
  });

  it("after a parameter change, six Pays all return the same ready session", async () => {
    const { stripe, pay } = setup();
    await pay("card", ["lot"]);
    const ids = new Set<string>();
    for (let i = 0; i < 6; i += 1) ids.add(readyId(await pay("card", ["lot", "courier"])));
    expect(ids.size).toBe(1);
    expect(stripe.open()).toEqual([...ids]);
  });

  it("after two changes only the newest session stays open", async () => {
    const { stripe, pay } = setup();
    await pay("card", ["lot"]);
    await pay("card", ["lot", "courier"]);
    const last = readyId(await pay("card", ["lot", "courier", "framing"]));
    await pay("card", ["lot", "courier", "framing"]);
    expect(stripe.open()).toEqual([last]);
  });

  it("A then B then A six times ends with one open session and a bounded history", async () => {
    const { stripe, pay } = setup();
    await pay("card", ["a"]);
    await pay("card", ["b"]);
    let last = "";
    for (let i = 0; i < 6; i += 1) {
      const outcome = await pay("card", ["a"]);
      expect(outcome.kind).toBe("ready");
      last = readyId(outcome);
    }
    expect(stripe.open()).toEqual([last]);
    expect(stripe.sessions.size).toBe(3);
  });

  it("a session closed outside the app is replaced once, then reused by six more Pays", async () => {
    const { stripe, pay } = setup();
    const first = readyId(await pay("card", ["lot"]));
    stripe.closeExternally(first);
    const ids = new Set<string>();
    for (let i = 0; i < 6; i += 1) ids.add(readyId(await pay("card", ["lot"])));
    expect(ids.size).toBe(1);
    expect([...ids][0]).not.toBe(first);
    expect(stripe.open()).toEqual([...ids]);
    expect(stripe.sessions.size).toBe(2);
  });

  it("after a hold closes the open session, releasing and paying opens exactly one new one", async () => {
    const { stripe, pay } = setup();
    const held = readyId(await pay("card", ["lot"]));
    stripe.closeExternally(held);
    const first = readyId(await pay("card", ["lot"]));
    expect(first).not.toBe(held);
    expect(readyId(await pay("card", ["lot"]))).toBe(first);
    expect(stripe.open()).toEqual([first]);
  });

  it("card, bank, card six times leaves one open session per rail and none replaced", async () => {
    const { stripe, pay } = setup();
    const card = readyId(await pay("card", ["lot"]));
    const bank = readyId(await pay("bank", ["lot"]));
    for (let i = 0; i < 6; i += 1) {
      expect(readyId(await pay("card", ["lot"]))).toBe(card);
      expect(readyId(await pay("bank", ["lot"]))).toBe(bank);
    }
    expect(stripe.open("card")).toEqual([card]);
    expect(stripe.open("bank")).toEqual([bank]);
    expect(stripe.sessions.size).toBe(2);
  });

  it("a changed card checkout never closes the bank transfer the buyer was given", async () => {
    const { stripe, pay } = setup();
    const bank = readyId(await pay("bank", ["lot"]));
    stripe.giveTransferInstructions(bank);
    await pay("card", ["lot"]);
    await pay("card", ["lot", "courier"]);
    // Instructions were given, so Stripe completed the session; it is left exactly so.
    expect(stripe.sessions.get(bank)?.status).toBe("complete");
    expect(stripe.cancelledIntents).toEqual([]);
  });

  it("a changed bank checkout leaves a transfer that has instructions open, and closes one that has none", async () => {
    const { stripe, pay } = setup();
    const funded = readyId(await pay("bank", ["a"]));
    stripe.giveTransferInstructions(funded);
    const unfunded = readyId(await pay("bank", ["b"]));
    const newest = readyId(await pay("bank", ["c"]));
    expect(stripe.open("bank")).toEqual([newest]);
    expect(stripe.sessions.get(funded)?.status).toBe("complete");
    expect(stripe.sessions.get(unfunded)?.status).toBe("expired");
  });

  it("after a parameter change, paying by bank closes the card session opened at the old amount", async () => {
    const { stripe, pay } = setup();
    const oldCard = readyId(await pay("card", ["lot"]));
    const bank = readyId(await pay("bank", ["lot", "courier"]));
    expect(stripe.sessions.get(oldCard)?.status).toBe("expired");
    expect(stripe.open()).toEqual([bank]);
  });

  it("a card session the buyer pays while it is being closed is not marked closed", async () => {
    const { stripe, ledger, pay, recordEvent } = setup();
    const oldCard = readyId(await pay("card", ["lot"]));
    // The buyer completes the old card page between our read and Stripe's expire.
    stripe.completeOnExpire.add(oldCard);
    await pay("bank", ["lot", "courier"]);
    expect(stripe.sessions.get(oldCard)?.status).toBe("complete");
    const rows = await ledger.listSessions("pay-1");
    expect(rows.find((r) => r.stripeSessionId === oldCard)?.closedAt).toBeNull();
    expect(recordEvent).toHaveBeenCalledWith("checkout_session_completed_during_close");
    // The paid session still counts: no other checkout is offered while it is confirmed.
    expect(await pay("card", ["lot", "courier"])).toEqual({ kind: "already_complete" });
  });

  it("a same-rail session the buyer pays while it is being closed is not marked closed", async () => {
    const { stripe, ledger, pay } = setup();
    const old = readyId(await pay("card", ["lot"]));
    stripe.completeOnExpire.add(old);
    await pay("card", ["lot", "courier"]);
    const rows = await ledger.listSessions("pay-1");
    expect(rows.find((r) => r.stripeSessionId === old)?.closedAt).toBeNull();
  });

  it("paying by bank for unchanged parameters leaves the card session open", async () => {
    const { stripe, pay } = setup();
    const card = readyId(await pay("card", ["lot"]));
    const bank = readyId(await pay("bank", ["lot"]));
    expect(stripe.open("card")).toEqual([card]);
    expect(stripe.open("bank")).toEqual([bank]);
  });

  it("after a parameter change, a bank transfer with instructions is kept whatever rail is picked", async () => {
    const { stripe, pay } = setup();
    const funded = readyId(await pay("bank", ["lot"]));
    stripe.giveTransferInstructions(funded);
    const oldCard = readyId(await pay("card", ["lot"]));
    await pay("bank", ["lot", "courier"]);
    expect(stripe.sessions.get(funded)?.status).toBe("complete");
    expect(stripe.cancelledIntents).toEqual([]);
    expect(stripe.sessions.get(oldCard)?.status).toBe("expired");
  });

  it("after a parameter change, an open bank session that already has an intent is never closed", async () => {
    const { stripe, pay } = setup();
    const started = readyId(await pay("bank", ["lot"]));
    // The buyer reached the instructions step; Stripe attached an intent before completing it.
    const session = stripe.sessions.get(started);
    if (session) session.paymentIntent = `pi_${started}`;
    await pay("bank", ["lot", "courier"]);
    await pay("card", ["lot", "courier", "framing"]);
    expect(stripe.sessions.get(started)?.status).toBe("open");
  });

  it("paying by bank closes a card session recorded before fingerprints were stored", async () => {
    const { stripe, ledger, pay } = setup();
    const legacyCard = await stripe.createCardCheckoutSession({ idempotencyKey: "old" } as never);
    await ledger.record("pay-1", legacyCard.sessionId);
    const bank = readyId(await pay("bank", ["lot"]));
    expect(stripe.sessions.get(legacyCard.sessionId)?.status).toBe("expired");
    expect(stripe.open()).toEqual([bank]);
  });

  it("two Pays at once get one session", async () => {
    const { stripe, pay } = setup();
    const [a, b] = await Promise.all([pay("card", ["lot"]), pay("card", ["lot"])]);
    expect(readyId(a)).toBe(readyId(b));
    expect(stripe.sessions.size).toBe(1);
  });

  it("a failure closing a superseded session is reported and does not fail the Pay", async () => {
    const { stripe, pay, report } = setup();
    const old = readyId(await pay("card", ["a"]));
    stripe.failExpireFor.add(old);
    const outcome = await pay("card", ["b"]);
    expect(outcome.kind).toBe("ready");
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({ code: "checkout_session_close_failed" }),
    );
  });

  it("a key Stripe refuses anyway is reported and the session opens under a key of its own", async () => {
    const { stripe, lifecycle, report } = setup();
    const create = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error("clash"), { type: "StripeIdempotencyError" }))
      .mockImplementation((key: string) =>
        stripe.createCardCheckoutSession({ paymentId: "pay-1", idempotencyKey: key } as never),
      );
    const outcome = await lifecycle.openOrRenew("card", "pay-1", { v: 1 }, create);
    expect(outcome.kind).toBe("ready");
    expect(create.mock.calls[1]?.[0]).toMatch(/:clash:/);
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({ code: "checkout_idempotency_clash" }),
    );
  });

  it("other Stripe errors are not hidden", async () => {
    const { lifecycle } = setup();
    const create = vi.fn().mockRejectedValue(new Error("card_declined"));
    await expect(lifecycle.openOrRenew("card", "pay-1", {}, create)).rejects.toThrow(
      "card_declined",
    );
  });

  it("returns already_complete when the buyer's session was paid", async () => {
    const { stripe, pay } = setup();
    const id = readyId(await pay("card", ["lot"]));
    stripe.complete(id);
    expect(await pay("card", ["lot"])).toEqual({ kind: "already_complete" });
  });

  it("closes a session recorded before rails were stored only when it is the same rail", async () => {
    const { stripe, ledger, pay } = setup();
    const legacyBank = await stripe.createBankTransferCheckoutSession({
      idempotencyKey: "old",
    } as never);
    await ledger.record("pay-1", legacyBank.sessionId);
    const card = readyId(await pay("card", ["lot"]));
    expect(stripe.open("bank")).toEqual([legacyBank.sessionId]);
    expect(stripe.open("card")).toEqual([card]);
  });

  it("once any session is paid, no other rail or parameters get a new payable session", async () => {
    const { stripe, ledger, pay } = setup();
    const paid = readyId(await pay("card", ["lot"]));
    stripe.complete(paid);
    expect(await pay("card", ["lot", "courier"])).toEqual({ kind: "already_complete" });
    expect(await pay("bank", ["lot"])).toEqual({ kind: "already_complete" });
    expect(stripe.sessions.size).toBe(1);
    const recorded = await ledger.listSessions("pay-1");
    expect(recorded.find((r) => r.stripeSessionId === paid)?.closedAt).toBeNull();
  });

  it("never marks a paid session closed when superseding", async () => {
    const { stripe, ledger, lifecycle } = setup();
    const paid = await stripe.createCardCheckoutSession({ idempotencyKey: "k0" } as never);
    await ledger.record("pay-1", paid.sessionId, { rail: "card", parametersFingerprint: "old" });
    const session = stripe.sessions.get(paid.sessionId);
    if (session) session.status = "complete";
    // A session that completed after the check began: settling elsewhere must leave it alone.
    const spy = vi.spyOn(stripe, "retrieveCheckoutSession");
    spy.mockResolvedValueOnce({ id: paid.sessionId, status: "open" } as never);
    await payOn(lifecycle, stripe, "card", ["new"]);
    expect((await ledger.listSessions("pay-1"))[0]?.closedAt).toBeNull();
    expect(session?.status).toBe("complete");
  });

  it("two tabs settling at once with different parameters each keep a live session", async () => {
    const { stripe, pay } = setup();
    const [a, b] = await Promise.all([pay("card", ["a"]), pay("card", ["b"])]);
    const ids = [readyId(a), readyId(b)];
    // Only the session recorded first may be closed by the later one, never the reverse.
    expect(stripe.open()).toContain(ids[1]);
    expect(stripe.sessions.get(ids[1] as string)?.status).toBe("open");
  });

  it("bank instructions shown (complete, unpaid): Pay by card opens a card session and leaves the transfer", async () => {
    const { stripe, ledger, pay } = setup();
    const bank = readyId(await pay("bank", ["lot"]));
    stripe.giveTransferInstructions(bank);

    const outcome = await pay("card", ["lot"]);

    expect(outcome.kind).toBe("ready");
    const card = readyId(outcome);
    expect(stripe.sessions.get(card)?.rail).toBe("card");
    expect(stripe.open()).toEqual([card]);
    expect(stripe.sessions.get(bank)?.status).toBe("complete");
    expect(stripe.cancelledIntents).toEqual([]);
    expect(
      (await ledger.listSessions("pay-1")).find((r) => r.stripeSessionId === bank)?.closedAt,
    ).toBeNull();
  });

  it("bank instructions shown: Pay by bank again returns the hosted instructions and keeps the session", async () => {
    const { stripe, pay } = setup();
    const bank = readyId(await pay("bank", ["lot"]));
    stripe.giveTransferInstructions(bank);

    const again = await pay("bank", ["lot"]);

    expect(again).toEqual({
      kind: "ready",
      session: {
        sessionId: bank,
        url: `https://stripe/instructions/pi_${bank}`,
        paymentIntentId: null,
      },
    });
    expect(stripe.sessions.get(bank)?.status).toBe("complete");
    expect(stripe.sessions.size).toBe(1);
  });

  it("bank transfer paid (complete, paid): Pay answers already_complete on every rail", async () => {
    const { stripe, pay } = setup();
    const bank = readyId(await pay("bank", ["lot"]));
    stripe.giveTransferInstructions(bank);
    stripe.fullyFund(bank);

    expect(await pay("card", ["lot"])).toEqual({ kind: "already_complete" });
    expect(await pay("bank", ["lot"])).toEqual({ kind: "already_complete" });
    expect(stripe.sessions.size).toBe(1);
  });

  it("a succeeded intent counts as paid even before the session's payment_status catches up", async () => {
    const { stripe, pay } = setup();
    const bank = readyId(await pay("bank", ["lot"]));
    stripe.giveTransferInstructions(bank);
    const intent = stripe.intents.get(`pi_${bank}`);
    if (intent) intent.status = "succeeded";

    expect(await pay("card", ["lot"])).toEqual({ kind: "already_complete" });
  });

  describe("closeAfterCapture", () => {
    it("closes an unfunded bank session and cancels its intent after a card payment", async () => {
      const { stripe, ledger, lifecycle, pay } = setup();
      const bank = readyId(await pay("bank", ["lot"]));
      stripe.giveTransferInstructions(bank);
      const card = readyId(await pay("card", ["lot"]));
      const paidIntent = stripe.complete(card);

      await lifecycle.closeAfterCapture("pay-1", paidIntent);

      expect(stripe.open()).toEqual([]);
      expect(stripe.cancelledIntents).toEqual([`pi_${bank}`]);
      const rows = await ledger.listSessions("pay-1");
      expect(rows.find((r) => r.stripeSessionId === bank)?.closedAt).toBeTruthy();
      // The session that paid is left exactly as it was.
      expect(rows.find((r) => r.stripeSessionId === card)?.closedAt).toBeNull();
      expect(stripe.sessions.get(card)?.status).toBe("complete");
    });

    it("closes another card session opened for old parameters", async () => {
      const { stripe, ledger, lifecycle, pay } = setup();
      const paid = readyId(await pay("card", ["lot", "courier"]));
      const paidIntent = stripe.complete(paid);
      // A session for old parameters still open next to the one that paid (a second tab).
      const stale = await stripe.createCardCheckoutSession({ idempotencyKey: "old" } as never);
      await ledger.record("pay-1", stale.sessionId, { rail: "card", parametersFingerprint: "old" });
      expect(stripe.open()).toEqual([stale.sessionId]);

      await lifecycle.closeAfterCapture("pay-1", paidIntent);

      expect(stripe.open()).toEqual([]);
      expect(stripe.cancelledIntents).toEqual([]);
    });

    it("after capture, a session completed while it is being closed is left open in the ledger", async () => {
      const { stripe, ledger, lifecycle, pay } = setup();
      const other = readyId(await pay("card", ["lot"]));
      const paid = readyId(await pay("bank", ["lot"]));
      const paidIntent = stripe.complete(paid);
      stripe.completeOnExpire.add(other);

      await lifecycle.closeAfterCapture("pay-1", paidIntent);

      const rows = await ledger.listSessions("pay-1");
      expect(rows.find((r) => r.stripeSessionId === other)?.closedAt).toBeNull();
    });

    it("leaves a partly funded bank session alone", async () => {
      const { stripe, ledger, lifecycle, pay, recordEvent } = setup();
      const bank = readyId(await pay("bank", ["lot"]));
      stripe.giveTransferInstructions(bank);
      stripe.partiallyFund(bank, 1000);
      const card = readyId(await pay("card", ["lot"]));
      const paidIntent = stripe.complete(card);

      await lifecycle.closeAfterCapture("pay-1", paidIntent);

      expect(stripe.sessions.get(bank)?.status).toBe("complete");
      expect(stripe.cancelledIntents).toEqual([]);
      expect(recordEvent).toHaveBeenCalledWith("checkout_left_open_funded_after_capture");
      const rows = await ledger.listSessions("pay-1");
      expect(rows.find((r) => r.stripeSessionId === bank)?.closedAt).toBeNull();
    });

    it("is a no-op when the webhook is redelivered", async () => {
      const { stripe, lifecycle, pay, report } = setup();
      const bank = readyId(await pay("bank", ["lot"]));
      stripe.giveTransferInstructions(bank);
      const card = readyId(await pay("card", ["lot"]));
      const paidIntent = stripe.complete(card);

      await lifecycle.closeAfterCapture("pay-1", paidIntent);
      await lifecycle.closeAfterCapture("pay-1", paidIntent);

      expect(stripe.cancelledIntents).toEqual([`pi_${bank}`]);
      expect(report).not.toHaveBeenCalled();
    });

    it("cancels the intent of a complete, unpaid, unfunded bank session and closes it", async () => {
      const { stripe, ledger, lifecycle, pay } = setup();
      const bank = readyId(await pay("bank", ["lot"]));
      stripe.giveTransferInstructions(bank);
      const card = readyId(await pay("card", ["lot"]));
      const paidIntent = stripe.complete(card);

      await lifecycle.closeAfterCapture("pay-1", paidIntent);

      expect(stripe.cancelledIntents).toEqual([`pi_${bank}`]);
      expect(stripe.sessions.get(bank)?.status).toBe("complete");
      expect(
        (await ledger.listSessions("pay-1")).find((r) => r.stripeSessionId === bank)?.closedAt,
      ).toBeTruthy();
    });

    it("leaves a funded bank session open and records it for finance, every time", async () => {
      const { stripe, ledger, lifecycle, pay, recordEvent, report } = setup();
      const bank = readyId(await pay("bank", ["lot"]));
      stripe.giveTransferInstructions(bank);
      stripe.partiallyFund(bank, 1);
      const card = readyId(await pay("card", ["lot"]));
      const paidIntent = stripe.complete(card);

      await lifecycle.closeAfterCapture("pay-1", paidIntent);

      expect(stripe.cancelledIntents).toEqual([]);
      expect(recordEvent).toHaveBeenCalledWith("checkout_left_open_funded_after_capture");
      expect(report).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "checkout_left_open_funded_after_capture",
          severity: "info",
        }),
      );
      expect(
        (await ledger.listSessions("pay-1")).find((r) => r.stripeSessionId === bank)?.closedAt,
      ).toBeNull();
    });

    it("opens a finance task for a part-paid transfer once the invoice is paid another way", async () => {
      const recordUnapplied = vi.fn(async () => {});
      const { stripe, lifecycle, pay } = setup(recordUnapplied);
      const bank = readyId(await pay("bank", ["lot"]));
      stripe.giveTransferInstructions(bank);
      stripe.partiallyFund(bank, 1000);
      const card = readyId(await pay("card", ["lot"]));
      const paidIntent = stripe.complete(card);

      await lifecycle.closeAfterCapture("pay-1", paidIntent);

      expect(recordUnapplied).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: "transfer_partially_funded_after_paid",
          paymentId: "pay-1",
          stripePaymentIntentId: `pi_${bank}`,
          amountCents: 1000,
        }),
      );
    });

    it("records the part received from what Stripe says is still to send, not amount_received", async () => {
      const recordUnapplied = vi.fn(async () => {});
      const { stripe, lifecycle, pay } = setup(recordUnapplied);
      const bank = readyId(await pay("bank", ["lot"]));
      stripe.giveTransferInstructions(bank);
      stripe.partiallyFund(bank, 1000);
      const intent = await stripe.retrievePaymentIntent(`pi_${bank}`);
      expect(intent.amount_received).toBe(0);
      const card = readyId(await pay("card", ["lot"]));

      await lifecycle.closeAfterCapture("pay-1", stripe.complete(card));

      const remaining = intent.next_action?.display_bank_transfer_instructions?.amount_remaining;
      expect(recordUnapplied).toHaveBeenCalledWith(
        expect.objectContaining({ amountCents: intent.amount - (remaining ?? 0) }),
      );
    });

    it("reports, and keeps the capture, when the finance task cannot be recorded", async () => {
      const { stripe, lifecycle, pay, report } = setup(async () => {
        throw new Error("db down");
      });
      const bank = readyId(await pay("bank", ["lot"]));
      stripe.giveTransferInstructions(bank);
      stripe.partiallyFund(bank, 1000);
      const card = readyId(await pay("card", ["lot"]));
      const paidIntent = stripe.complete(card);

      await expect(lifecycle.closeAfterCapture("pay-1", paidIntent)).resolves.toBeUndefined();

      expect(report).toHaveBeenCalledWith(
        expect.objectContaining({ code: "checkout_cleanup_after_capture_failed" }),
      );
    });

    it("expires an open session that has an intent instead of cancelling the intent", async () => {
      const { stripe, ledger, lifecycle, pay } = setup();
      const paid = readyId(await pay("card", ["a"]));
      const paidIntent = stripe.complete(paid);
      const open = await stripe.createCardCheckoutSession({ idempotencyKey: "old" } as never);
      await ledger.record("pay-1", open.sessionId, { rail: "card", parametersFingerprint: "old" });
      const session = stripe.sessions.get(open.sessionId);
      if (session) session.paymentIntent = `pi_${open.sessionId}`;
      stripe.intents.set(`pi_${open.sessionId}`, {
        status: "requires_payment_method",
        amount: 5000,
        received: 0,
        remaining: 5000,
      });

      await lifecycle.closeAfterCapture("pay-1", paidIntent);

      expect(stripe.cancelledIntents).toEqual([]);
      expect(stripe.sessions.get(open.sessionId)?.status).toBe("expired");
      expect(stripe.intents.get(`pi_${open.sessionId}`)?.status).toBe("canceled");
      expect(
        (await ledger.listSessions("pay-1")).find((r) => r.stripeSessionId === open.sessionId)
          ?.closedAt,
      ).toBeTruthy();
    });

    it("finishes a half-done cleanup: intent already cancelled, expire failed first time", async () => {
      const { stripe, ledger, lifecycle, pay } = setup();
      const paid = readyId(await pay("card", ["a"]));
      const paidIntent = stripe.complete(paid);
      const open = await stripe.createCardCheckoutSession({ idempotencyKey: "old" } as never);
      await ledger.record("pay-1", open.sessionId, { rail: "card", parametersFingerprint: "old" });
      const session = stripe.sessions.get(open.sessionId);
      if (session) session.paymentIntent = `pi_${open.sessionId}`;
      stripe.intents.set(`pi_${open.sessionId}`, {
        status: "canceled",
        amount: 5000,
        received: 0,
        remaining: 5000,
      });
      stripe.failExpireFor.add(open.sessionId);

      await lifecycle.closeAfterCapture("pay-1", paidIntent);
      expect(stripe.sessions.get(open.sessionId)?.status).toBe("open");

      stripe.failExpireFor.clear();
      await lifecycle.closeAfterCapture("pay-1", paidIntent);
      expect(stripe.sessions.get(open.sessionId)?.status).toBe("expired");
      expect(
        (await ledger.listSessions("pay-1")).find((r) => r.stripeSessionId === open.sessionId)
          ?.closedAt,
      ).toBeTruthy();
    });

    it("a cancel that fails because the transfer just landed is info, not an error", async () => {
      const { stripe, ledger, lifecycle, pay, report, recordEvent } = setup();
      const bank = readyId(await pay("bank", ["lot"]));
      stripe.giveTransferInstructions(bank);
      stripe.cancelRefusedFor.add(`pi_${bank}`);
      const card = readyId(await pay("card", ["lot"]));
      const paidIntent = stripe.complete(card);

      await lifecycle.closeAfterCapture("pay-1", paidIntent);

      expect(report).toHaveBeenCalledTimes(1);
      expect(report).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "checkout_intent_settled_during_cleanup",
          severity: "info",
        }),
      );
      expect(report).not.toHaveBeenCalledWith(expect.objectContaining({ severity: "error" }));
      expect(recordEvent).toHaveBeenCalledWith("checkout_intent_settled_during_cleanup");
      expect(
        (await ledger.listSessions("pay-1")).find((r) => r.stripeSessionId === bank)?.closedAt,
      ).toBeNull();
    });

    it("a cancel that fails for another reason is reported as an error and retried", async () => {
      const { stripe, ledger, lifecycle, pay, report } = setup();
      const bank = readyId(await pay("bank", ["lot"]));
      stripe.giveTransferInstructions(bank);
      stripe.failCancelFor.add(`pi_${bank}`);
      const card = readyId(await pay("card", ["lot"]));
      const paidIntent = stripe.complete(card);

      await lifecycle.closeAfterCapture("pay-1", paidIntent);
      expect(report).toHaveBeenCalledWith(
        expect.objectContaining({ code: "checkout_cleanup_after_capture_failed" }),
      );

      stripe.failCancelFor.clear();
      await lifecycle.closeAfterCapture("pay-1", paidIntent);
      expect(
        (await ledger.listSessions("pay-1")).find((r) => r.stripeSessionId === bank)?.closedAt,
      ).toBeTruthy();
    });

    it("reports a failed close, never throws, and retries it on redelivery", async () => {
      const { stripe, ledger, lifecycle, pay, report } = setup();
      const paid = readyId(await pay("card", ["b"]));
      const paidIntent = stripe.complete(paid);
      const staleSession = await stripe.createCardCheckoutSession({
        idempotencyKey: "old",
      } as never);
      const stale = staleSession.sessionId;
      await ledger.record("pay-1", stale, { rail: "card", parametersFingerprint: "old" });
      stripe.failExpireFor.add(stale);

      await expect(lifecycle.closeAfterCapture("pay-1", paidIntent)).resolves.toBeUndefined();

      expect(report).toHaveBeenCalledWith(
        expect.objectContaining({ code: "checkout_cleanup_after_capture_failed" }),
      );
      expect(
        (await ledger.listSessions("pay-1")).find((r) => r.stripeSessionId === stale)?.closedAt,
      ).toBeNull();

      stripe.failExpireFor.clear();
      await lifecycle.closeAfterCapture("pay-1", paidIntent);
      expect(stripe.open()).toEqual([]);
    });
  });
});
