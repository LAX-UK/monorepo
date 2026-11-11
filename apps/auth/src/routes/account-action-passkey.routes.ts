import {
  type HostedAuthCapabilities,
  buildHostedAddPasskeyHtml,
  buildHostedPasskeyExpiredHtml,
  hostedAuthViewFromSearch,
} from "@auction/auth";
import {
  ACCOUNT_ACTION_PASSKEY_PATH,
  ACCOUNT_SIGN_IN_METHOD_RETURN_PARAM,
  isValidPasskeyName,
} from "@auction/identity-contracts";
import { type Context, Hono } from "hono";
import { applyHostedAuthCspNonce } from "../lib/apply-hosted-auth-csp-nonce.js";
import { HOSTED_AUTH_CSP_NONCE_KEY } from "../middleware/security-headers.js";
import type { AccountSignInMethodsService } from "../services/account-sign-in-methods.service.js";
import type { PasskeyEnrolmentGrants } from "../services/passkey-enrolment-grant.js";

export const ACCOUNT_ACTION_PASSKEY_RENAME_PATH = `${ACCOUNT_ACTION_PASSKEY_PATH}/rename`;

export type AccountActionPasskeyRouteDeps = {
  capabilities: HostedAuthCapabilities;
  /** The issuer session the browser's cookie holds, or null. */
  getSession(headers: Headers): Promise<{ session: { id: string }; user: { id: string } } | null>;
  grants: Pick<PasskeyEnrolmentGrants, "holds">;
  methods: Pick<AccountSignInMethodsService, "renamePasskey">;
  /** The issuer's own origin: the only origin a rename may come from. */
  issuerOrigin: string;
  /** LAX Account's origin. The person is only ever sent back to its Security page. */
  accountOrigin: string;
  /** Seconds to wait when the caller is over its budget, otherwise null. */
  rateLimit(key: string): Promise<number | null>;
  clientKey(c: Context): string;
  onFailure?: (error: unknown) => void;
};

/**
 * The issuer's page for making a passkey, and the one call it makes of its own.
 *
 * The page shows "ready" only to the browser that holds the permission the one-time hand-off
 * gave: the same session, spent once. Anything else (no sign-in, no permission, a spent or
 * expired ticket) shows the same "link expired" page, which says nothing about the account. The
 * ceremony itself runs against Better Auth's passkey endpoints behind the request policy; this
 * file only serves the page and renames a passkey the person has just made.
 */
export function createAccountActionPasskeyRoutes(deps: AccountActionPasskeyRouteDeps) {
  const app = new Hono();
  const returnUrl = new URL("/account/security", `${deps.accountOrigin}/`);
  const view = () => hostedAuthViewFromSearch("", deps.capabilities);

  function lock(c: Context): void {
    c.header("Cache-Control", "no-store");
    c.header("Pragma", "no-cache");
    c.header("Referrer-Policy", "no-referrer");
  }

  function page(c: Context, html: string, status: 200 | 403 | 429): Response {
    const nonce = c.get(HOSTED_AUTH_CSP_NONCE_KEY);
    const body = typeof nonce === "string" ? applyHostedAuthCspNonce(html, nonce) : html;
    return c.html(body, status);
  }

  function expired(c: Context, status: 403 | 429 = 403): Response {
    return page(
      c,
      buildHostedPasskeyExpiredHtml({ returnUrl: returnUrl.toString() }, view()),
      status,
    );
  }

  async function limited(c: Context): Promise<boolean> {
    const wait = await deps.rateLimit(deps.clientKey(c)).catch(() => null);
    return wait !== null;
  }

  app.get(ACCOUNT_ACTION_PASSKEY_PATH, async (c) => {
    lock(c);
    if (await limited(c)) return expired(c, 429);
    try {
      const browser = await deps.getSession(c.req.raw.headers);
      if (!browser || !(await deps.grants.holds(browser.session.id, browser.user.id))) {
        return expired(c);
      }
      const ready = new URL(returnUrl);
      ready.searchParams.set(ACCOUNT_SIGN_IN_METHOD_RETURN_PARAM, "passkey_added");
      return page(
        c,
        buildHostedAddPasskeyHtml(
          { returnUrl: returnUrl.toString(), savedReturnUrl: ready.toString() },
          view(),
        ),
        200,
      );
    } catch (error) {
      deps.onFailure?.(error);
      return expired(c);
    }
  });

  app.post(ACCOUNT_ACTION_PASSKEY_RENAME_PATH, async (c) => {
    lock(c);
    // A cookie-authenticated write: only this page, on this origin, sending JSON, may make it.
    if (c.req.header("origin") !== deps.issuerOrigin) return c.json({ error: "forbidden" }, 403);
    if (!c.req.header("content-type")?.toLowerCase().startsWith("application/json")) {
      return c.json({ error: "invalid_request" }, 415);
    }
    if (await limited(c)) return c.json({ error: "rate_limited" }, 429);
    const body = (await c.req.json().catch(() => null)) as {
      passkeyId?: unknown;
      name?: unknown;
    } | null;
    if (
      typeof body?.passkeyId !== "string" ||
      typeof body.name !== "string" ||
      !isValidPasskeyName(body.name)
    ) {
      return c.json({ error: "invalid_request" }, 400);
    }
    try {
      const browser = await deps.getSession(c.req.raw.headers);
      if (!browser) return c.json({ error: "unauthorized" }, 401);
      const result = await deps.methods.renamePasskey(browser.user.id, body.passkeyId, body.name);
      return result.ok ? c.json({ renamed: true }) : c.json({ error: "not_found" }, 404);
    } catch (error) {
      deps.onFailure?.(error);
      return c.json({ error: "temporarily_unavailable" }, 503);
    }
  });

  return app;
}
