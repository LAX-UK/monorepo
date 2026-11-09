import {
  ACCOUNT_REAUTH_REQUIRED,
  ACCOUNT_SIGN_IN_METHODS_INTENT_PATH,
  ACCOUNT_SIGN_IN_METHODS_PASSKEY_REMOVE_PATH,
  ACCOUNT_SIGN_IN_METHODS_PASSKEY_RENAME_PATH,
  ACCOUNT_SIGN_IN_METHODS_PATH,
  ACCOUNT_SIGN_IN_METHODS_UNLINK_PATH,
  type AccountActionIntentResponse,
  type AccountPasskeyRemovedResponse,
  type AccountPasskeyRenamedResponse,
  type AccountSignInMethodsResponse,
  signInMethodKindSchema,
  socialSignInProviderSchema,
} from "@auction/identity-contracts";
import { Hono } from "hono";
import type { AccountActionService } from "../services/account-action.service.js";
import type {
  AccountSignInMethodRefusal,
  AccountSignInMethodsService,
} from "../services/account-sign-in-methods.service.js";
import { type AccountCallerDeps, authenticateAccountCaller } from "./account-caller.js";

export type AccountSignInMethodsRouteDeps = Omit<AccountCallerDeps, "rateLimit"> & {
  methods: Pick<AccountSignInMethodsService, "read" | "unlink" | "renamePasskey" | "removePasskey">;
  /** Starts the one-time hand-off for adding a way to sign in. */
  actions: Pick<AccountActionService, "start">;
  /** Budget for reads. */
  readRateLimit: AccountCallerDeps["rateLimit"];
  /** Tighter per-person budget for removals. */
  writeRateLimit: AccountCallerDeps["rateLimit"];
  onFailure?: (error: unknown) => void;
};

const REFUSAL_STATUS: Record<AccountSignInMethodRefusal, 404 | 422> = {
  last_sign_in_method: 422,
  not_linked: 404,
};

/** What refusing to start an add looks like to LAX Account. */
const INTENT_REFUSAL_STATUS = {
  not_available: 404,
  staff_not_allowed: 403,
  already_linked: 409,
} as const;

/**
 * Lets LAX Account show and remove the ways the signed-in person signs in. Reading needs only the
 * person's token; removing a social sign-in also carries `sid` and needs a recent sign-in (403
 * `reauth_required` otherwise). Authorisation is described on authenticateAccountCaller. The
 * response names a provider and when it was linked, and nothing that identifies the person's
 * account at the provider.
 */
export function createAccountSignInMethodsRoutes(deps: AccountSignInMethodsRouteDeps) {
  const app = new Hono();

  app.post(ACCOUNT_SIGN_IN_METHODS_PATH, async (c) => {
    const caller = await authenticateAccountCaller(c, { ...deps, rateLimit: deps.readRateLimit });
    if (caller instanceof Response) return caller;
    try {
      const methods: AccountSignInMethodsResponse = await deps.methods.read(caller.subjectId);
      return c.json({
        hasPassword: methods.hasPassword,
        social: methods.social,
        passkeys: methods.passkeys,
        available: methods.available,
      });
    } catch (error) {
      deps.onFailure?.(error);
      return c.json({ error: "temporarily_unavailable" }, 503);
    }
  });

  app.post(ACCOUNT_SIGN_IN_METHODS_INTENT_PATH, async (c) => {
    const caller = await authenticateAccountCaller(c, { ...deps, rateLimit: deps.writeRateLimit });
    if (caller instanceof Response) return caller;
    const sid = caller.params.get("sid");
    const action = signInMethodKindSchema.safeParse(caller.params.get("action"));
    if (!sid || !action.success) return c.json({ error: "invalid_request" }, 400);
    try {
      const result = await deps.actions.start(caller.subjectId, sid, action.data);
      if (result.ok) {
        const body: AccountActionIntentResponse = { url: result.url };
        return c.json(body);
      }
      return "reason" in result
        ? c.json({ error: ACCOUNT_REAUTH_REQUIRED }, 403)
        : c.json({ error: result.kind }, INTENT_REFUSAL_STATUS[result.kind]);
    } catch (error) {
      deps.onFailure?.(error);
      return c.json({ error: "temporarily_unavailable" }, 503);
    }
  });

  app.post(ACCOUNT_SIGN_IN_METHODS_PASSKEY_RENAME_PATH, async (c) => {
    const caller = await authenticateAccountCaller(c, { ...deps, rateLimit: deps.writeRateLimit });
    if (caller instanceof Response) return caller;
    const passkeyId = caller.params.get("passkeyId");
    const name = caller.params.get("name");
    if (!passkeyId || name === null) return c.json({ error: "invalid_request" }, 400);
    try {
      const result = await deps.methods.renamePasskey(caller.subjectId, passkeyId, name);
      if (result.ok) {
        const body: AccountPasskeyRenamedResponse = { passkey: result.passkey };
        return c.json(body);
      }
      return result.kind === "invalid_name"
        ? c.json({ error: "invalid_request" }, 400)
        : c.json({ error: result.kind }, REFUSAL_STATUS[result.kind]);
    } catch (error) {
      deps.onFailure?.(error);
      return c.json({ error: "temporarily_unavailable" }, 503);
    }
  });

  app.post(ACCOUNT_SIGN_IN_METHODS_PASSKEY_REMOVE_PATH, async (c) => {
    const caller = await authenticateAccountCaller(c, { ...deps, rateLimit: deps.writeRateLimit });
    if (caller instanceof Response) return caller;
    const sid = caller.params.get("sid");
    const passkeyId = caller.params.get("passkeyId");
    if (!sid || !passkeyId) return c.json({ error: "invalid_request" }, 400);
    try {
      const result = await deps.methods.removePasskey(caller.subjectId, sid, passkeyId);
      if (result.ok) {
        const body: AccountPasskeyRemovedResponse = {
          removed: true,
          revokedSessions: result.revokedSessions,
        };
        return c.json(body);
      }
      return "reason" in result
        ? c.json({ error: ACCOUNT_REAUTH_REQUIRED }, 403)
        : c.json({ error: result.kind }, REFUSAL_STATUS[result.kind]);
    } catch (error) {
      deps.onFailure?.(error);
      return c.json({ error: "temporarily_unavailable" }, 503);
    }
  });

  app.post(ACCOUNT_SIGN_IN_METHODS_UNLINK_PATH, async (c) => {
    const caller = await authenticateAccountCaller(c, { ...deps, rateLimit: deps.writeRateLimit });
    if (caller instanceof Response) return caller;
    const sid = caller.params.get("sid");
    const provider = socialSignInProviderSchema.safeParse(caller.params.get("provider"));
    if (!sid || !provider.success) return c.json({ error: "invalid_request" }, 400);
    try {
      const result = await deps.methods.unlink(caller.subjectId, sid, provider.data);
      if (result.ok) {
        return c.json({ unlinked: result.unlinked, revokedSessions: result.revokedSessions });
      }
      return "reason" in result
        ? c.json({ error: ACCOUNT_REAUTH_REQUIRED }, 403)
        : c.json({ error: result.kind }, REFUSAL_STATUS[result.kind]);
    } catch (error) {
      deps.onFailure?.(error);
      return c.json({ error: "temporarily_unavailable" }, 503);
    }
  });

  return app;
}
