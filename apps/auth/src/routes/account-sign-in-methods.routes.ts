import {
  ACCOUNT_REAUTH_REQUIRED,
  ACCOUNT_SIGN_IN_METHODS_PATH,
  ACCOUNT_SIGN_IN_METHODS_UNLINK_PATH,
  type AccountSignInMethodsResponse,
  socialSignInProviderSchema,
} from "@auction/identity-contracts";
import { Hono } from "hono";
import type {
  AccountSignInMethodRefusal,
  AccountSignInMethodsService,
} from "../services/account-sign-in-methods.service.js";
import { type AccountCallerDeps, authenticateAccountCaller } from "./account-caller.js";

export type AccountSignInMethodsRouteDeps = Omit<AccountCallerDeps, "rateLimit"> & {
  methods: Pick<AccountSignInMethodsService, "read" | "unlink">;
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
