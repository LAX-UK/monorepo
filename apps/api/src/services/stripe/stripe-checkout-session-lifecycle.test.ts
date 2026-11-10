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
});
