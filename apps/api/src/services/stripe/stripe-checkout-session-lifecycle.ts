import { createHash, randomUUID } from "node:crypto";
import type {
  CheckoutSessionRail,
  IPaymentCheckoutSessionStore,
  RecordedCheckoutSession,
} from "@auction/persistence/interfaces";
import type Stripe from "stripe";
import type { IErrorReporter } from "../interfaces/error-handling.js";
import type {
  CreateCheckoutSessionResult,
  IStripePaymentGateway,
} from "./stripe-payment-gateway.js";

export type { CheckoutSessionRail };

/**
 * A short, stable fingerprint of a checkout's parameters. It is part of the idempotency key, so
 * one key always means one set of parameters: Stripe replays the session for the same parameters
 * and a changed invoice (new lines, delivery) gets a key, and a session, of its own.
 */
export function checkoutParametersFingerprint(parameters: object): string {
  return createHash("sha256").update(JSON.stringify(parameters)).digest("hex").slice(0, 16);
}

/**
 * The key for the nth session opened for these parameters. Everyone who sees the same recorded
 * sessions derives the same key (two tabs, a double click get one session); once that session is
 * closed the count moves on, so a fresh session is opened instead of Stripe replaying the old one.
 */
export function checkoutSessionIdempotencyKey(
  rail: CheckoutSessionRail,
  paymentId: string,
  fingerprint: string,
  openedBefore: number,
): string {
  return `checkout:${rail}:payment:${paymentId}:p:${fingerprint}:n${openedBefore}`;
}

/** True when the buyer can still complete payment on this hosted Checkout page. */
export function isCheckoutSessionUsable(session: Stripe.Checkout.Session): boolean {
  if (session.status === "complete") return false;
  if (session.status === "expired") return false;
  if (session.status === "open") {
    if (session.expires_at != null && session.expires_at * 1000 <= Date.now()) return false;
    return Boolean(session.url);
  }
  return false;
}

/** Stripe's answer to a key reused with different parameters (not two requests at once). */
export function isIdempotencyParameterMismatch(err: unknown): boolean {
  const e = err as { type?: unknown; code?: unknown } | null;
  return e?.type === "StripeIdempotencyError" && e.code !== "idempotency_key_in_use";
}

export type RenewCheckoutSessionOutcome =
  | { kind: "ready"; session: CreateCheckoutSessionResult }
  | { kind: "already_complete" }
  | { kind: "unavailable"; error: string };

/** How many unusable sessions in a row an attempt may step over before giving up. */
const MAX_RENEWALS = 3;

type LiveSession = { kind: "ready"; session: CreateCheckoutSessionResult } | { kind: "complete" };
type SessionStatus = LiveSession | { kind: "dead" };

/**
 * Gives the buyer one payable Checkout session for an invoice and rail. The newest open session
 * opened for the same parameters is reused; otherwise one is opened (its key derived from how many
 * were opened for those parameters). Only once the buyer's session is settled are the rail's other
 * open sessions closed, so a session still being paid is never closed for a failed attempt, and a
 * card payment never closes a bank transfer the buyer was given instructions for.
 */
export class CheckoutSessionLifecycle {
  constructor(
    private readonly gateway: Pick<
      IStripePaymentGateway,
      | "retrieveCheckoutSession"
      | "expireCheckoutSession"
      | "retrievePaymentIntent"
      | "cancelPaymentIntent"
    >,
    private readonly ledger: Pick<
      IPaymentCheckoutSessionStore,
      "record" | "listSessions" | "markClosed"
    >,
    private readonly reporter: IErrorReporter,
  ) {}

  async openOrRenew(
    rail: CheckoutSessionRail,
    paymentId: string,
    parameters: object,
    create: (idempotencyKey: string) => Promise<CreateCheckoutSessionResult>,
  ): Promise<RenewCheckoutSessionOutcome> {
    const fingerprint = checkoutParametersFingerprint(parameters);
    for (let attempt = 0; attempt <= MAX_RENEWALS; attempt += 1) {
      const recorded = await this.ledger.listSessions(paymentId);
      if (await this.anyComplete(recorded)) return { kind: "already_complete" };
      const sameParameters = recorded.filter(
        (s) => s.rail === rail && s.parametersFingerprint === fingerprint,
      );
      const reused = await this.findOpen(sameParameters);
      if (reused) return this.settle(reused, rail, paymentId);

      const key = checkoutSessionIdempotencyKey(
        rail,
        paymentId,
        fingerprint,
        sameParameters.length,
      );
      const created = await this.createWithKey(key, create);
      await this.ledger.record(paymentId, created.sessionId, {
        rail,
        parametersFingerprint: fingerprint,
      });
      const status = await this.inspect(created.sessionId);
      if (status.kind === "dead") {
        await this.ledger.markClosed(created.sessionId);
        continue;
      }
      return this.settle(status, rail, paymentId);
    }
    return { kind: "unavailable", error: "Stripe checkout session is not open" };
  }

  /**
   * Once an invoice's payment is captured, closes its other recorded open sessions on every rail so
   * the buyer cannot pay it a second time. The session that paid is never touched, and an intent
   * with money received or on its way is left for the unapplied-money path. Idempotent (a closed
   * session is skipped), and it never throws: a failure is reported and the capture stands.
   */
  async closeAfterCapture(paymentId: string, paidPaymentIntentId: string | null): Promise<void> {
    let recorded: RecordedCheckoutSession[];
    try {
      recorded = await this.ledger.listSessions(paymentId);
    } catch (err) {
      this.reportCleanupFailure(err);
      return;
    }
    for (const session of recorded) {
      if (session.closedAt) continue;
      try {
        await this.closeOtherAfterCapture(session, paidPaymentIntentId);
      } catch (err) {
        this.reportCleanupFailure(err);
      }
    }
  }

  private reportCleanupFailure(cause: unknown): void {
    this.reporter.report({
      message: "Could not close a checkout session after the payment was captured",
      status: 500,
      code: "checkout_cleanup_after_capture_failed",
      severity: "error",
      cause,
    });
  }

  private async closeOtherAfterCapture(
    recorded: RecordedCheckoutSession,
    paidPaymentIntentId: string | null,
  ): Promise<void> {
    const stripeSession = await this.gateway.retrieveCheckoutSession(recorded.stripeSessionId);
    const intentId =
      typeof stripeSession.payment_intent === "string"
        ? stripeSession.payment_intent
        : (stripeSession.payment_intent?.id ?? null);
    if (paidPaymentIntentId && intentId === paidPaymentIntentId) return;
    // A paid session is never closed: its payment is being confirmed.
    if (stripeSession.status === "complete") return;
    if (stripeSession.status === "open") {
      if (intentId) {
        const intent = await this.gateway.retrievePaymentIntent(intentId);
        if (!isUnfundedIntent(intent)) return;
        await this.gateway.cancelPaymentIntent(intentId);
      }
      await this.gateway.expireCheckoutSession(recorded.stripeSessionId);
    }
    await this.ledger.markClosed(recorded.stripeSessionId);
  }

  /**
   * Whether the buyer already paid on any session of the invoice, whatever its rail or
   * parameters: a second payable session must not be offered while that payment is confirmed.
   */
  private async anyComplete(recorded: readonly RecordedCheckoutSession[]): Promise<boolean> {
    for (const session of recorded) {
      if (session.closedAt) continue;
      const stripeSession = await this.gateway.retrieveCheckoutSession(session.stripeSessionId);
      if (stripeSession.status === "complete") return true;
    }
    return false;
  }

  /** The newest recorded session of these parameters that can still be paid (or was). */
  private async findOpen(
    sessions: readonly RecordedCheckoutSession[],
  ): Promise<LiveSession | null> {
    for (const recorded of [...sessions].reverse()) {
      if (recorded.closedAt) continue;
      const status = await this.inspect(recorded.stripeSessionId);
      if (status.kind !== "dead") return status;
      await this.ledger.markClosed(recorded.stripeSessionId);
    }
    return null;
  }

  private async inspect(sessionId: string): Promise<SessionStatus> {
    const stripeSession = await this.gateway.retrieveCheckoutSession(sessionId);
    if (stripeSession.status === "complete") return { kind: "complete" };
    if (!isCheckoutSessionUsable(stripeSession) || !stripeSession.url) return { kind: "dead" };
    const paymentIntentId =
      typeof stripeSession.payment_intent === "string"
        ? stripeSession.payment_intent
        : (stripeSession.payment_intent?.id ?? null);
    return {
      kind: "ready",
      session: { sessionId, url: stripeSession.url, paymentIntentId },
    };
  }

  private async createWithKey(
    key: string,
    create: (idempotencyKey: string) => Promise<CreateCheckoutSessionResult>,
  ): Promise<CreateCheckoutSessionResult> {
    try {
      return await create(key);
    } catch (err) {
      if (!isIdempotencyParameterMismatch(err)) throw err;
      // The key carries the parameters, so Stripe should never refuse it. Say so, and open the
      // session under a key of its own rather than fail the buyer.
      this.reporter.report({
        message: "Stripe refused a parameter-keyed checkout idempotency key",
        status: 500,
        code: "checkout_idempotency_clash",
        severity: "error",
        cause: err,
      });
      return create(`${key}:clash:${randomUUID()}`);
    }
  }

  private async settle(
    status: LiveSession,
    rail: CheckoutSessionRail,
    paymentId: string,
  ): Promise<RenewCheckoutSessionOutcome> {
    if (status.kind === "complete") return { kind: "already_complete" };
    await this.closeSuperseded(rail, paymentId, status.session.sessionId);
    return { kind: "ready", session: status.session };
  }

  /**
   * Closes the rail's open sessions recorded before the one the buyer is settled on, so two tabs
   * settling at once never close each other's. A failure is reported, never passed to the buyer.
   */
  private async closeSuperseded(
    rail: CheckoutSessionRail,
    paymentId: string,
    keepSessionId: string,
  ): Promise<void> {
    for (const recorded of await this.ledger.listSessions(paymentId)) {
      if (recorded.stripeSessionId === keepSessionId) break;
      if (recorded.closedAt) continue;
      try {
        await this.closeIfSameRail(recorded, rail);
      } catch (err) {
        this.reporter.report({
          message: "Could not close a superseded checkout session",
          status: 500,
          code: "checkout_session_close_failed",
          severity: "warn",
          cause: err,
        });
      }
    }
  }

  private async closeIfSameRail(
    recorded: RecordedCheckoutSession,
    rail: CheckoutSessionRail,
  ): Promise<void> {
    const stripeSession = await this.gateway.retrieveCheckoutSession(recorded.stripeSessionId);
    if ((recorded.rail ?? railOf(stripeSession)) !== rail) return;
    // A paid session is never closed: its payment is still being confirmed.
    if (stripeSession.status === "complete") return;
    if (stripeSession.status === "open") {
      // A bank transfer with a payment intent has been given instructions: money may be on its way.
      if (rail === "bank" && stripeSession.payment_intent) return;
      await this.gateway.expireCheckoutSession(recorded.stripeSessionId);
    }
    await this.ledger.markClosed(recorded.stripeSessionId);
  }
}

/** The rail of a session recorded before rails were stored. */
function railOf(session: Stripe.Checkout.Session): CheckoutSessionRail {
  return session.payment_method_types?.includes("customer_balance") ? "bank" : "card";
}

/**
 * True when nothing was paid into the intent: it is still waiting for the buyer (a bank transfer
 * with instructions shown counts) and no amount was received, not even a partial transfer.
 */
function isUnfundedIntent(intent: Stripe.PaymentIntent): boolean {
  if (
    intent.status !== "requires_payment_method" &&
    intent.status !== "requires_confirmation" &&
    intent.status !== "requires_action"
  ) {
    return false;
  }
  if ((intent.amount_received ?? 0) > 0) return false;
  const remaining = intent.next_action?.display_bank_transfer_instructions?.amount_remaining;
  return remaining == null || remaining >= intent.amount;
}
