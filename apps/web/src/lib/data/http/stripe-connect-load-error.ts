import { readJsonBody } from "@/lib/data/http/envelope";
import type { StripeConnectLoadError } from "@/lib/data/http/stripe-connect.types";

/** The load error for a failed status or sync response. */
export async function connectLoadErrorOf(res: Response): Promise<StripeConnectLoadError> {
  if (res.status === 401) return "unauthorized";
  if (res.status === 404) return "not_connected";
  // Where Stripe is not set up (a test or development stack) there is no account to read. That is
  // not a failure: the page says payout setup is not available here yet.
  if (res.status === 503) {
    const body = (await readJsonBody(res).catch(() => null)) as { error?: unknown } | null;
    if (body?.error === "stripe_not_configured") return "not_connected";
  }
  if (res.status === 409) {
    const body = (await readJsonBody(res).catch(() => null)) as { error?: unknown } | null;
    if (body?.error === "stripe_account_unreachable") return "account_unreachable";
  }
  return "server_error";
}
