import {
  ACCOUNT_PROFILE_PATH,
  ACCOUNT_PROFILE_UPDATE_PATH,
  ACCOUNT_REAUTH_REQUIRED,
  ACCOUNT_SESSIONS_PATH,
  ACCOUNT_SESSIONS_REVOKE_OTHERS_PATH,
  ACCOUNT_SESSIONS_REVOKE_PATH,
  accountNameSchema,
} from "@auction/identity-contracts";
import { type Context, Hono } from "hono";
import type { AccountIdentityService } from "../services/account-identity.service.js";
import { type AccountCallerDeps, authenticateAccountCaller } from "./account-caller.js";

export type AccountIdentityRouteDeps = Omit<AccountCallerDeps, "rateLimit"> & {
  identity: Pick<
    AccountIdentityService,
    "readProfile" | "rename" | "listSessions" | "revokeSession" | "revokeOtherSessions"
  >;
  /** Budget for reads (the profile and the session list). */
  readRateLimit: AccountCallerDeps["rateLimit"];
  /** Tighter budget for changes. */
  writeRateLimit: AccountCallerDeps["rateLimit"];
  onFailure?: (error: unknown) => void;
};

function reauthRequired(c: Context): Response {
  return c.json({ error: ACCOUNT_REAUTH_REQUIRED }, 403);
}

/**
 * Lets LAX Account read and rename the signed-in person and manage their sign-ins, so the
 * identity settings live in one place instead of in each product.
 *
 * Authorisation is described on authenticateAccountCaller. On top of that, every call that
 * touches sessions carries `sid`, the sign-in LAX Account holds. The service checks it against
 * the person's live sessions, and changes (rename, sign out) also require it to be recent: the
 * caller gets 403 `reauth_required` and sends the person through a fresh sign-in.
 */
export function createAccountIdentityRoutes(deps: AccountIdentityRouteDeps) {
  const app = new Hono();
  const reads: AccountCallerDeps = { ...deps, rateLimit: deps.readRateLimit };
  const writes: AccountCallerDeps = { ...deps, rateLimit: deps.writeRateLimit };

  /** Runs the handler, mapping an unexpected failure to a generic 503 that leaks nothing. */
  async function guarded(c: Context, run: () => Promise<Response>): Promise<Response> {
    try {
      return await run();
    } catch (error) {
      deps.onFailure?.(error);
      return c.json({ error: "temporarily_unavailable" }, 503);
    }
  }

  app.post(ACCOUNT_PROFILE_PATH, async (c) => {
    const caller = await authenticateAccountCaller(c, reads);
    if (caller instanceof Response) return caller;
    return guarded(c, async () => {
      const profile = await deps.identity.readProfile(caller.subjectId);
      if (!profile) return c.json({ error: "invalid_token" }, 401);
      return c.json({ name: profile.name });
    });
  });

  app.post(ACCOUNT_PROFILE_UPDATE_PATH, async (c) => {
    const caller = await authenticateAccountCaller(c, writes);
    if (caller instanceof Response) return caller;
    const sid = caller.params.get("sid");
    const name = accountNameSchema.safeParse(caller.params.get("name"));
    if (!sid || !name.success) return c.json({ error: "invalid_request" }, 400);
    return guarded(c, async () => {
      const result = await deps.identity.rename(caller.subjectId, sid, name.data);
      return result.ok ? c.json({ name: result.name }) : reauthRequired(c);
    });
  });

  app.post(ACCOUNT_SESSIONS_PATH, async (c) => {
    const caller = await authenticateAccountCaller(c, reads);
    if (caller instanceof Response) return caller;
    const sid = caller.params.get("sid");
    if (!sid) return c.json({ error: "invalid_request" }, 400);
    return guarded(c, async () => {
      const result = await deps.identity.listSessions(caller.subjectId, sid);
      if (!result.ok) return reauthRequired(c);
      // Picked field by field so a future row field (an IP address, a token) is never exposed.
      return c.json({
        sessions: result.sessions.map((session) => ({
          id: session.id,
          userAgent: session.userAgent,
          createdAt: session.createdAt.toISOString(),
          lastActiveAt: session.lastActiveAt.toISOString(),
          isCurrent: session.isCurrent,
        })),
      });
    });
  });

  app.post(ACCOUNT_SESSIONS_REVOKE_PATH, async (c) => {
    const caller = await authenticateAccountCaller(c, writes);
    if (caller instanceof Response) return caller;
    const sid = caller.params.get("sid");
    const sessionId = caller.params.get("session_id");
    if (!sid || !sessionId) return c.json({ error: "invalid_request" }, 400);
    return guarded(c, async () => {
      const result = await deps.identity.revokeSession(caller.subjectId, sid, sessionId);
      if (result.ok) return c.json({ revoked: result.revoked });
      return result.reason === "reauth_required"
        ? reauthRequired(c)
        : c.json({ error: result.reason }, 400);
    });
  });

  app.post(ACCOUNT_SESSIONS_REVOKE_OTHERS_PATH, async (c) => {
    const caller = await authenticateAccountCaller(c, writes);
    if (caller instanceof Response) return caller;
    const sid = caller.params.get("sid");
    if (!sid) return c.json({ error: "invalid_request" }, 400);
    return guarded(c, async () => {
      const result = await deps.identity.revokeOtherSessions(caller.subjectId, sid);
      return result.ok ? c.json({ revoked: result.revoked }) : reauthRequired(c);
    });
  });

  return app;
}
