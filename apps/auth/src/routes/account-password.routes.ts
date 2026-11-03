import {
  ACCOUNT_PASSWORD_CHANGE_PATH,
  ACCOUNT_PASSWORD_MAX_LENGTH,
  ACCOUNT_REAUTH_REQUIRED,
} from "@auction/identity-contracts";
import { type Context, Hono } from "hono";
import type {
  AccountPasswordRefusal,
  AccountPasswordService,
} from "../services/account-password.service.js";
import { type AccountCallerDeps, authenticateAccountCaller } from "./account-caller.js";

export type AccountPasswordRouteDeps = AccountCallerDeps & {
  password: Pick<AccountPasswordService, "change">;
  onFailure?: (error: unknown) => void;
};

const REFUSAL_STATUS: Record<AccountPasswordRefusal, 403 | 422> = {
  invalid_password: 403,
  invalid_password_policy: 422,
  password_breached: 422,
  same_password: 422,
};

/**
 * Lets LAX Account change the signed-in person's password, or set a first one.
 *
 * Authorisation is described on authenticateAccountCaller. The call also carries `sid` and needs
 * a recent sign-in (403 `reauth_required` otherwise). The rate limit is per person and strict,
 * because the current password is checked here and must not be guessable. Passwords travel only
 * in the request body and appear in no response.
 */
export function createAccountPasswordRoutes(deps: AccountPasswordRouteDeps) {
  const app = new Hono();

  app.post(ACCOUNT_PASSWORD_CHANGE_PATH, async (c: Context) => {
    const caller = await authenticateAccountCaller(c, deps);
    if (caller instanceof Response) return caller;
    const sid = caller.params.get("sid");
    const newPassword = caller.params.get("new_password");
    const currentPassword = caller.params.get("current_password");
    if (
      !sid ||
      !newPassword ||
      newPassword.length > ACCOUNT_PASSWORD_MAX_LENGTH * 2 ||
      (currentPassword?.length ?? 0) > ACCOUNT_PASSWORD_MAX_LENGTH * 2
    ) {
      return c.json({ error: "invalid_request" }, 400);
    }
    try {
      const result = await deps.password.change(caller.subjectId, sid, {
        currentPassword: currentPassword || null,
        newPassword,
      });
      if (result.ok) return c.json({ changed: true, created: result.created });
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
