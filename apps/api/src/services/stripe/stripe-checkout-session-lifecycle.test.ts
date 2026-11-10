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

function setup() {
  const stripe = new FakeCheckoutStripe();
  const ledger = new InMemoryCheckoutSessionLedger();
  const report = vi.fn();
  const lifecycle = new CheckoutSessionLifecycle(
    stripe as unknown as IStripePaymentGateway,
    ledger,
    { report },
  );
  const pay = (rail: "card" | "bank", lines: string[]) => payOn(lifecycle, stripe, rail, lines);
  return { stripe, ledger, report, lifecycle, pay };
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
    expect(stripe.open("bank")).toEqual([bank]);
  });

  it("a changed bank checkout leaves a transfer that has instructions open, and closes one that has none", async () => {
    const { stripe, pay } = setup();
    const funded = readyId(await pay("bank", ["a"]));
    stripe.giveTransferInstructions(funded);
    const unfunded = readyId(await pay("bank", ["b"]));
    const newest = readyId(await pay("bank", ["c"]));
    expect(stripe.open("bank").sort()).toEqual([funded, newest].sort());
    expect(stripe.sessions.get(unfunded)?.status).toBe("expired");
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
    const session = stripe.sessions.get(id);
    if (session) session.status = "complete";
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
    const session = stripe.sessions.get(paid);
    if (session) session.status = "complete";
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

    it("leaves a partly funded bank session alone", async () => {
      const { stripe, ledger, lifecycle, pay } = setup();
      const bank = readyId(await pay("bank", ["lot"]));
      stripe.giveTransferInstructions(bank);
      stripe.partiallyFund(bank, 1000);
      const card = readyId(await pay("card", ["lot"]));
      const paidIntent = stripe.complete(card);

      await lifecycle.closeAfterCapture("pay-1", paidIntent);

      expect(stripe.open("bank")).toEqual([bank]);
      expect(stripe.cancelledIntents).toEqual([]);
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
