import { commerceErrorMessage } from "@/lib/commerce-error-message";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";

/** Why the email step could not go on; each reason has its own message and next step. */
export type GuestEmailProblem = "invalid_email" | "rate_limited" | "unavailable" | "failed";

export type GuestEmailStepResult =
  | { kind: "continue_as_guest" }
  | { kind: "sign_in_required" }
  | { kind: "error"; problem: GuestEmailProblem; message: string };

export const GUEST_EMAIL_MESSAGES: Record<GuestEmailProblem, string> = {
  invalid_email: "Enter an email address, like name@example.com.",
  rate_limited:
    "We have had too many attempts from you in a short time. Wait a few minutes and try again, or sign in.",
  unavailable:
    "We cannot check out without an account just now. Sign in to continue, or try again in a few minutes.",
  failed: "We could not check your email. Try again, or sign in to continue.",
};

function upstreamCode(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const code = (body as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

function problem(kind: GuestEmailProblem): GuestEmailStepResult {
  return { kind: "error", problem: kind, message: GUEST_EMAIL_MESSAGES[kind] };
}

/** Reads the shop API's answer to the email step. */
export function guestEmailStepResult(status: number, body: unknown): GuestEmailStepResult {
  if (status === 200 && body && typeof body === "object") {
    const outcome = (body as { outcome?: unknown }).outcome;
    if (outcome === "continue_as_guest" || outcome === "sign_in_required") return { kind: outcome };
    return problem("failed");
  }
  if (status === 429) return problem("rate_limited");
  if (status === 503) return problem("unavailable");
  if (status === 400) return problem("invalid_email");
  return problem("failed");
}

export type GuestOrderStartResult =
  | { kind: "redirect"; checkoutUrl: string }
  | { kind: "sign_in_required" }
  | { kind: "error"; message: string };

/** Reads the shop API's answer to placing a guest order. */
export function guestOrderStartResult(status: number, body: unknown): GuestOrderStartResult {
  if (status === 200 && body && typeof body === "object") {
    const checkoutUrl = (body as { checkoutUrl?: unknown }).checkoutUrl;
    if (typeof checkoutUrl === "string" && checkoutUrl.length > 0) {
      return { kind: "redirect", checkoutUrl };
    }
    return {
      kind: "error",
      message: "Checkout returned an unexpected response. Try again shortly.",
    };
  }
  if (upstreamCode(body) === SHOP_API_ERROR_CODES.ACCOUNT_EXISTS)
    return { kind: "sign_in_required" };
  if (status === 429) return { kind: "error", message: GUEST_EMAIL_MESSAGES.rate_limited };
  if (status === 503) return { kind: "error", message: GUEST_EMAIL_MESSAGES.unavailable };
  return {
    kind: "error",
    message: commerceErrorMessage(
      body,
      "Checkout could not be started. Review your basket and try again.",
    ),
  };
}

/** Where a known email signs in: back to checkout, with the basket brought along. */
export const GUEST_SIGN_IN_RETURN_PATH = "/checkout";
