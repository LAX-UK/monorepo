import { createHash, randomUUID } from "node:crypto";
import type { UnappliedMoney } from "@auction/domain";
import type {
  CheckoutSessionRail,
  IPaymentCheckoutSessionStore,
  RecordedCheckoutSession,
} from "@auction/persistence/interfaces";
import type Stripe from "stripe";
import { recordMoneyPathEvent } from "../../middleware/metrics.js";
import type { ICheckoutCleanupAfterCapture } from "../interfaces/checkout-cleanup.js";
import type { IErrorReporter } from "../interfaces/error-handling.js";
import { transferFunding } from "./bank-transfer-funding.js";
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
 * Parameters only one rail sends (bank transfer names the Stripe customer whose balance receives
 * the money). They are left out when comparing a session with another rail's.
 */
const RAIL_ONLY_PARAMETER_KEYS: readonly string[] = ["stripeCustomerId"];

/**
 * The fingerprint of what the buyer is asked to pay, whatever the rail: the parameters without
 * the rail-only ones. For card parameters (which carry none) it equals the session fingerprint,
 * so a recorded card session can be compared with a checkout on either rail.
 */
export function invoiceParametersFingerprint(parameters: object): string {
  const shared = Object.fromEntries(
    Object.entries(parameters).filter(([key]) => !RAIL_ONLY_PARAMETER_KEYS.includes(key)),
  );
  return checkoutParametersFingerprint(shared);
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
/**
 * `awaiting_transfer`: the buyer chose bank transfer and has the instructions. Stripe completes
 * such a session while it is still unpaid; it is neither payable again nor a payment.
 */
type SessionStatus =
  | LiveSession
  | { kind: "awaiting_transfer"; instructionsUrl: string | null }
  | { kind: "dead" };

/**
 * True when the buyer has paid on this session. A Checkout session also reaches "complete" for a
 * bank transfer that is still waiting for funds (payment_status "unpaid"), which is not a payment.
 */
function isSessionPaid(session: Stripe.Checkout.Session): boolean {
  return session.status === "complete" && session.payment_status !== "unpaid";
}

/** A session the buyer completed by choosing bank transfer, whose funds have not arrived. */
function isAwaitingTransfer(session: Stripe.Checkout.Session): boolean {
  return session.status === "complete" && session.payment_status === "unpaid";
}

function paymentIntentIdOf(session: Stripe.Checkout.Session): string | null {
  return typeof session.payment_intent === "string"
    ? session.payment_intent
    : (session.payment_intent?.id ?? null);
}

/** Opens a finance task for money that cannot be applied; the caller owns the transaction. */
export type RecordUnappliedMoney = (money: UnappliedMoney) => Promise<void>;

/**
 * Gives the buyer one payable Checkout session for an invoice and rail. The newest open session
 * opened for the same parameters is reused; otherwise one is opened (its key derived from how many
 * were opened for those parameters). Only once the buyer's session is settled are the rail's other
 * open sessions closed, so a session still being paid is never closed for a failed attempt, and a
 * card payment never closes a bank transfer the buyer was given instructions for.
 */
export class CheckoutSessionLifecycle implements ICheckoutCleanupAfterCapture {
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
    private readonly recordEvent: (event: string) => void = recordMoneyPathEvent,
    private readonly recordUnapplied: RecordUnappliedMoney | null = null,
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
      if (await this.anyPaid(recorded)) return { kind: "already_complete" };
      const sameParameters = recorded.filter(
        (s) => s.rail === rail && s.parametersFingerprint === fingerprint,
      );
      const invoiceFingerprint = invoiceParametersFingerprint(parameters);
      const reused = await this.findOpen(sameParameters);
      if (reused) return this.settle(reused, rail, paymentId, invoiceFingerprint);

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
      // A session just opened cannot already be waiting on a transfer; if it is, leave it be.
      if (status.kind === "awaiting_transfer") continue;
      return this.settle(status, rail, paymentId, invoiceFingerprint);
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
        await this.closeOtherAfterCapture(session, paymentId, paidPaymentIntentId);
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
    paymentId: string,
    paidPaymentIntentId: string | null,
  ): Promise<void> {
    const stripeSession = await this.gateway.retrieveCheckoutSession(recorded.stripeSessionId);
    const intentId = paymentIntentIdOf(stripeSession);
    if (paidPaymentIntentId && intentId === paidPaymentIntentId) return;
    // A paid session is never closed: its payment is being confirmed.
    if (isSessionPaid(stripeSession)) return;

    if (isAwaitingTransfer(stripeSession)) {
      // The buyer was given transfer instructions and the session is complete, so only the intent
      // can be cancelled. Once any money is in, or on its way, it is left for finance.
      if (!intentId) return;
      const intent = await this.gateway.retrievePaymentIntent(intentId);
      if (intent.status !== "canceled") {
        if (!isUnfundedIntent(intent))
          return this.leaveFunded(recorded.stripeSessionId, paymentId, intent);
        if (!(await this.cancelUnfundedIntent(intentId))) return;
      }
      await this.ledger.markClosed(recorded.stripeSessionId);
      return;
    }

    if (stripeSession.status === "open") {
      if (intentId) {
        const intent = await this.gateway.retrievePaymentIntent(intentId);
        // An intent Stripe already cancelled holds nothing, and a half-done cleanup completes here.
        if (intent.status !== "canceled" && !isUnfundedIntent(intent)) {
          return this.leaveFunded(recorded.stripeSessionId, paymentId, intent);
        }
      }
      // Expiring the session makes Stripe cancel its intent; Stripe refuses a direct cancel of a
      // Checkout-managed intent.
      if (!(await this.expired(recorded.stripeSessionId))) return;
    }
    await this.ledger.markClosed(recorded.stripeSessionId);
  }

  /**
   * Expires a session and says whether it is now closed. A session the buyer completed while it
   * was being closed stays open in the ledger, so it still counts as paid (or as a transfer
   * given instructions) and the buyer is not offered another checkout.
   */
  private async expired(stripeSessionId: string): Promise<boolean> {
    const status = await this.gateway.expireCheckoutSession(stripeSessionId);
    if (status === "expired") return true;
    this.recordEvent("checkout_session_completed_during_close");
    this.reporter.report({
      message: `Checkout ${stripeSessionId} was not closed: Stripe reports it ${status ?? "unknown"}`,
      status: 200,
      code: "checkout_session_completed_during_close",
      severity: "info",
    });
    return false;
  }

  /**
   * Money is in (or coming) on a session that cannot be closed: finance sees it. A transfer that
   * arrived in part is money nobody else will report (its partially-funded notice came before the
   * invoice was paid), so it becomes a finance task; a fully received intent is reported by its
   * own succeeded event.
   */
  private async leaveFunded(
    stripeSessionId: string,
    paymentId: string,
    intent: Stripe.PaymentIntent,
  ): Promise<void> {
    this.recordEvent("checkout_left_open_funded_after_capture");
    // Stripe states a part transfer through what is still to send, not `amount_received`.
    const { receivedPence } = transferFunding(intent);
    const partTransfer = intent.status === "requires_action" && receivedPence > 0;
    if (partTransfer && this.recordUnapplied) {
      await this.recordUnapplied({
        reason: "transfer_partially_funded_after_paid",
        paymentId,
        paymentGroupId: null,
        stripePaymentIntentId: intent.id,
        stripeChargeId: null,
        stripeCustomerId: null,
        amountCents: receivedPence,
        currency: intent.currency,
      });
    }
    this.reporter.report({
      message: `Checkout ${stripeSessionId} holds transfer money for an invoice that was paid another way`,
      status: 200,
      code: "checkout_left_open_funded_after_capture",
      severity: "info",
    });
  }

  /**
   * Cancels the intent of a completed, unpaid bank session. False when the intent turned out to be
   * funded (the transfer landed since it was read): that is left for the unapplied-money path.
   */
  private async cancelUnfundedIntent(intentId: string): Promise<boolean> {
    try {
      await this.gateway.cancelPaymentIntent(intentId);
      return true;
    } catch (err) {
      if ((err as { code?: unknown } | null)?.code !== "payment_intent_unexpected_state") throw err;
      const current = await this.gateway.retrievePaymentIntent(intentId);
      if (current.status === "canceled") return true;
      if (current.status === "succeeded" || current.status === "processing") {
        this.recordEvent("checkout_intent_settled_during_cleanup");
        this.reporter.report({
          message: `Intent ${intentId} took money while its checkout was being closed; left as it is`,
          status: 200,
          code: "checkout_intent_settled_during_cleanup",
          severity: "info",
        });
        return false;
      }
      throw err;
    }
  }

  /**
   * Whether the buyer already paid on any session of the invoice, whatever its rail or
   * parameters: a second payable session must not be offered while that payment is confirmed.
   * A bank transfer session that is complete but unpaid is not a payment: the buyer may still
   * pay another way, and the transfer stays as it is.
   */
  private async anyPaid(recorded: readonly RecordedCheckoutSession[]): Promise<boolean> {
    for (const session of recorded) {
      if (session.closedAt) continue;
      const stripeSession = await this.gateway.retrieveCheckoutSession(session.stripeSessionId);
      if (isSessionPaid(stripeSession)) return true;
      if (!isAwaitingTransfer(stripeSession)) continue;
      // The funds may have landed before the session's payment_status caught up.
      const intentId = paymentIntentIdOf(stripeSession);
      if (intentId && (await this.gateway.retrievePaymentIntent(intentId)).status === "succeeded") {
        return true;
      }
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
      if (status.kind === "ready" || status.kind === "complete") return status;
      // Instructions already given: shown again when Stripe still has them, and never closed.
      if (status.kind === "awaiting_transfer") {
        if (status.instructionsUrl) {
          return {
            kind: "ready",
            session: {
              sessionId: recorded.stripeSessionId,
              url: status.instructionsUrl,
              paymentIntentId: null,
            },
          };
        }
        continue;
      }
      await this.ledger.markClosed(recorded.stripeSessionId);
    }
    return null;
  }

  private async inspect(sessionId: string): Promise<SessionStatus> {
    const stripeSession = await this.gateway.retrieveCheckoutSession(sessionId);
    if (isSessionPaid(stripeSession)) return { kind: "complete" };
    if (isAwaitingTransfer(stripeSession)) {
      const intentId = paymentIntentIdOf(stripeSession);
      if (!intentId) return { kind: "awaiting_transfer", instructionsUrl: null };
      const intent = await this.gateway.retrievePaymentIntent(intentId);
      if (intent.status === "succeeded") return { kind: "complete" };
      return {
        kind: "awaiting_transfer",
        instructionsUrl:
          intent.next_action?.display_bank_transfer_instructions?.hosted_instructions_url ?? null,
      };
    }
    if (!isCheckoutSessionUsable(stripeSession) || !stripeSession.url) return { kind: "dead" };
    const paymentIntentId = paymentIntentIdOf(stripeSession);
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
    invoiceFingerprint: string,
  ): Promise<RenewCheckoutSessionOutcome> {
    if (status.kind === "complete") return { kind: "already_complete" };
    await this.closeSuperseded(rail, paymentId, status.session.sessionId, invoiceFingerprint);
    return { kind: "ready", session: status.session };
  }

  /**
   * Closes the open sessions recorded before the one the buyer is settled on: every earlier
   * session of the same rail, and every earlier card session opened for other parameters whatever
   * rail the buyer picked now (it would take the old amount). Only sessions recorded before it are
   * touched, so two tabs settling at once never close each other's. A bank transfer that has been
   * given instructions is never closed. A failure is reported, never passed to the buyer.
   */
  private async closeSuperseded(
    rail: CheckoutSessionRail,
    paymentId: string,
    keepSessionId: string,
    invoiceFingerprint: string,
  ): Promise<void> {
    for (const recorded of await this.ledger.listSessions(paymentId)) {
      if (recorded.stripeSessionId === keepSessionId) break;
      if (recorded.closedAt) continue;
      try {
        await this.closeIfSuperseded(recorded, rail, invoiceFingerprint);
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

  private async closeIfSuperseded(
    recorded: RecordedCheckoutSession,
    rail: CheckoutSessionRail,
    invoiceFingerprint: string,
  ): Promise<void> {
    const stripeSession = await this.gateway.retrieveCheckoutSession(recorded.stripeSessionId);
    const sessionRail = recorded.rail ?? railOf(stripeSession);
    // A card session with no recorded fingerprint predates fingerprints: its amount is unknown.
    const staleCard =
      sessionRail === "card" && recorded.parametersFingerprint !== invoiceFingerprint;
    if (sessionRail !== rail && !staleCard) return;
    // A complete session is never closed: it is paid, or a bank transfer that was given
    // instructions and may be funded.
    if (stripeSession.status === "complete") return;
    if (stripeSession.status === "open") {
      // A bank transfer with a payment intent has been given instructions: money may be on its way.
      if (sessionRail === "bank" && stripeSession.payment_intent) return;
      if (!(await this.expired(recorded.stripeSessionId))) return;
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
  if (remaining != null) return remaining >= intent.amount;
  // Without a stated remainder only an intent that never took a payment method is known unfunded.
  return intent.status !== "requires_action";
}
