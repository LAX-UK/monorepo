import {
  decideGuestEmail,
  guestOrderSubject,
  isPlausibleGuestEmail,
  normaliseGuestEmail,
} from "@auction/shop-domain";
import type { EnquiryRateLimiter } from "../enquiry-rate-limit.js";
import type {
  CheckoutOrderInput,
  CheckoutOrderResult,
  CheckoutWriter,
} from "../ports/commerce.ports.js";
import type {
  GuestCustomerStore,
  GuestOrderLinks,
  LaxAccountDirectory,
} from "../ports/guest-checkout.ports.js";

/**
 * Every email check takes at least this long, whatever the answer, so the time a response takes
 * does not tell a known email from a new one.
 */
export const GUEST_EMAIL_CHECK_MIN_MS = 450;

export type GuestCheckoutRefusal =
  | { kind: "invalid_email" }
  | { kind: "rate_limited"; retryAfterSeconds: number }
  /** Identity could not answer; nobody continues as a guest without the check. */
  | { kind: "unavailable" }
  | { kind: "sign_in_required" };

export type GuestEmailCheckResult = { kind: "continue_as_guest" } | GuestCheckoutRefusal;

export type GuestOrderInput = Omit<CheckoutOrderInput, "subject" | "guest"> & {
  email: string;
  name: string;
  phone?: string;
  marketingConsent: boolean;
  basketTokenHash: string;
  clientIp: string | null;
};

export type GuestOrderResult =
  | {
      kind: "created";
      session: CheckoutOrderResult;
      /** Opens the order without an account; the storefront keeps it in an httpOnly cookie. */
      access: { token: string; expiresAt: Date };
    }
  | GuestCheckoutRefusal;

export type GuestCheckoutDeps = {
  accounts: LaxAccountDirectory;
  guests: GuestCustomerStore;
  checkout: Pick<CheckoutWriter, "createCheckoutOrder">;
  links: Pick<GuestOrderLinks, "issue">;
  rateLimiter: EnquiryRateLimiter;
  /** Called when the limiter cannot be reached; checks then continue rather than block a sale. */
  onRateLimitUnavailable?: (error: unknown) => void;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
  minimumCheckMs?: number;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Guest checkout: the email step, then the order. The server repeats every check when the order
 * is placed, so skipping the email step in the browser gains nothing.
 */
export function createGuestCheckoutService(deps: GuestCheckoutDeps) {
  const now = deps.now ?? (() => new Date());
  const sleep = deps.sleep ?? defaultSleep;
  const minimumCheckMs = deps.minimumCheckMs ?? GUEST_EMAIL_CHECK_MIN_MS;

  async function admit(
    email: string,
    clientIp: string | null,
  ): Promise<GuestCheckoutRefusal | { kind: "admitted"; email: string }> {
    if (!isPlausibleGuestEmail(email)) return { kind: "invalid_email" };
    const normalised = normaliseGuestEmail(email);
    try {
      const decision = await deps.rateLimiter.consume({
        clientIp,
        senderKey: `email:${normalised}`,
      });
      if (!decision.allowed) {
        return { kind: "rate_limited", retryAfterSeconds: decision.retryAfterSeconds };
      }
    } catch (error) {
      deps.onRateLimitUnavailable?.(error);
    }
    let hasLaxAccount: boolean;
    try {
      hasLaxAccount = await deps.accounts.hasAccount(normalised);
    } catch {
      return { kind: "unavailable" };
    }
    return decideGuestEmail({ hasLaxAccount }) === "sign_in_required"
      ? { kind: "sign_in_required" }
      : { kind: "admitted", email: normalised };
  }

  return {
    async checkEmail(input: {
      email: string;
      marketingConsent: boolean;
      clientIp: string | null;
    }): Promise<GuestEmailCheckResult> {
      const startedAt = Date.now();
      const admission = await admit(input.email, input.clientIp);
      let result: GuestEmailCheckResult;
      if (admission.kind === "admitted") {
        // A new email is a lead from here on, even if the guest never pays.
        await deps.guests.record(
          { email: admission.email, marketingConsent: input.marketingConsent },
          now(),
        );
        result = { kind: "continue_as_guest" };
      } else {
        result = admission;
      }
      const remaining = minimumCheckMs - (Date.now() - startedAt);
      if (remaining > 0) await sleep(remaining);
      return result;
    },

    async placeOrder(input: GuestOrderInput): Promise<GuestOrderResult> {
      const admission = await admit(input.email, input.clientIp);
      if (admission.kind !== "admitted") return admission;
      const {
        email: _email,
        name,
        phone,
        marketingConsent,
        basketTokenHash,
        clientIp: _clientIp,
        ...order
      } = input;
      const { guestCustomerId } = await deps.guests.record(
        {
          email: admission.email,
          name: name.trim(),
          ...(phone?.trim() ? { phone: phone.trim() } : {}),
          marketingConsent,
        },
        now(),
      );
      const session = await deps.checkout.createCheckoutOrder({
        ...order,
        subject: guestOrderSubject(guestCustomerId),
        guest: { guestCustomerId, basketTokenHash },
      });
      const access = await deps.links.issue(session.orderId, now());
      return { kind: "created", session, access };
    },
  };
}

export type GuestCheckoutService = ReturnType<typeof createGuestCheckoutService>;
