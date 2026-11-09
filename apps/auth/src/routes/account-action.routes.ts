import {
  ACCOUNT_ACTION_DONE_PATH,
  ACCOUNT_ACTION_PATH,
  ACCOUNT_SIGN_IN_METHOD_RETURN_PARAM,
  type AccountSignInMethodReturn,
  type SocialSignInProvider,
  socialSignInProviderSchema,
} from "@auction/identity-contracts";
import { type Context, Hono } from "hono";
import { isTicketSecret } from "../services/account-action-ticket.js";
import type { AccountActionService } from "../services/account-action.service.js";

export type AccountActionRouteDeps = {
  actions: Pick<AccountActionService, "redeem" | "isLinked">;
  /** The issuer session the browser's cookie holds, or null. */
  getSession(headers: Headers): Promise<{ session: { id: string }; user: { id: string } } | null>;
  /**
   * Starts the provider round trip for the person in `headers`, and returns the provider's page
   * and the cookies the round trip needs. This is the one place the issuer links a provider; the
   * library's own link endpoint is switched off.
   */
  startLink(
    provider: SocialSignInProvider,
    headers: Headers,
  ): Promise<{ url: string; cookies: readonly string[] }>;
  /** LAX Account's origin. The person is only ever sent back to its Security page. */
  accountOrigin: string;
  /** Seconds to wait when the caller is over its budget, otherwise null. */
  rateLimit(key: string): Promise<number | null>;
  clientKey(c: Context): string;
  onFailure?: (error: unknown) => void;
};

/** What the provider's error says, in the fixed words the Security page understands. */
export function returnWordForProviderError(error: string | undefined): AccountSignInMethodReturn {
  switch (error) {
    case "account_already_linked_to_different_user":
      return "already_linked_elsewhere";
    // Google says access_denied, Apple user_cancelled_authorize, when the person backs out.
    case "access_denied":
    case "user_cancelled_authorize":
    case "cancelled":
      return "cancelled";
    default:
      return "provider_unavailable";
  }
}

/**
 * The issuer's browser pages for adding a way to sign in. `/account-action` spends the one-time
 * ticket and sends the browser to Google or Apple; `/account-action/done` is where the provider
 * round trip ends. Both answer only with a redirect: the first to the provider or back to LAX
 * Account, the second back to LAX Account's Security page with one fixed word. No page here ever
 * shows text taken from the request, a provider or an error.
 */
export function createAccountActionRoutes(deps: AccountActionRouteDeps) {
  const app = new Hono();

  function back(c: Context, word: AccountSignInMethodReturn): Response {
    const target = new URL("/account/security", `${deps.accountOrigin}/`);
    target.searchParams.set(ACCOUNT_SIGN_IN_METHOD_RETURN_PARAM, word);
    return c.redirect(target.toString(), 302);
  }

  function lock(c: Context): void {
    c.header("Cache-Control", "no-store");
    c.header("Pragma", "no-cache");
    // The ticket rides in the address; it is spent on arrival, and nothing should carry it on.
    c.header("Referrer-Policy", "no-referrer");
  }

  async function limited(c: Context): Promise<Response | null> {
    const wait = await deps.rateLimit(deps.clientKey(c)).catch(() => null);
    return wait === null ? null : back(c, "rate_limited");
  }

  app.get(ACCOUNT_ACTION_PATH, async (c) => {
    lock(c);
    const refused = await limited(c);
    if (refused) return refused;
    const ticket = c.req.query("ticket");
    if (!isTicketSecret(ticket)) return back(c, "expired");
    try {
      const browser = await deps.getSession(c.req.raw.headers);
      const result = await deps.actions.redeem(
        ticket,
        browser ? { id: browser.session.id, userId: browser.user.id } : null,
      );
      if (!result.ok) {
        // Linked in another tab between the request and now: the person has what they asked for.
        if (result.code === "already_done") {
          return back(c, result.provider ? `${result.provider}_linked` : "provider_unavailable");
        }
        return back(c, result.code);
      }
      if (result.action === "passkey") return back(c, "provider_unavailable");
      const { url, cookies } = await deps.startLink(result.action, c.req.raw.headers);
      for (const cookie of cookies) c.header("Set-Cookie", cookie, { append: true });
      return c.redirect(url, 302);
    } catch (error) {
      deps.onFailure?.(error);
      return back(c, "provider_unavailable");
    }
  });

  app.get(ACCOUNT_ACTION_DONE_PATH, async (c) => {
    lock(c);
    const refused = await limited(c);
    if (refused) return refused;
    const provider = socialSignInProviderSchema.safeParse(c.req.query("provider"));
    if (!provider.success) return back(c, "provider_unavailable");
    try {
      const browser = await deps.getSession(c.req.raw.headers);
      if (!browser) return back(c, "reauth_required");
      const error = c.req.query("error");
      if (error) return back(c, returnWordForProviderError(error));
      // The outcome is read from the account, never taken from the address: a person who opens
      // this page by hand without linking anything is told the provider was not reachable.
      return (await deps.actions.isLinked(browser.user.id, provider.data))
        ? back(c, `${provider.data}_linked`)
        : back(c, "provider_unavailable");
    } catch (error) {
      deps.onFailure?.(error);
      return back(c, "provider_unavailable");
    }
  });

  return app;
}
