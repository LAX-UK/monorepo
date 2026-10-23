import {
  ACCOUNT_BACKUP_CODES_REGENERATE_PATH,
  ACCOUNT_REAUTH_REQUIRED,
} from "@auction/identity-contracts";
import { type Context, Hono } from "hono";
import type { AccountBackupCodesService } from "../services/account-backup-codes.service.js";
import { type AccountCallerDeps, authenticateAccountCaller } from "./account-caller.js";

export type AccountBackupCodesRouteDeps = AccountCallerDeps & {
  backupCodes: Pick<AccountBackupCodesService, "regenerate">;
  onFailure?: (error: unknown) => void;
};

/**
 * Lets LAX Account create a new set of backup codes for the signed-in person.
 *
 * Authorisation is described on authenticateAccountCaller: the person is whoever owns LAX
 * Account's own access token, never a field in the request. The call also carries `sid` and
 * needs a recent sign-in (403 `reauth_required` otherwise), because replacing the codes ends the
 * old ones. This is the only response that ever contains the codes and it is never cached.
 */
export function createAccountBackupCodesRoutes(deps: AccountBackupCodesRouteDeps) {
  const app = new Hono();

  app.post(ACCOUNT_BACKUP_CODES_REGENERATE_PATH, async (c: Context) => {
    const caller = await authenticateAccountCaller(c, deps);
    if (caller instanceof Response) return caller;
    const sid = caller.params.get("sid");
    if (!sid) return c.json({ error: "invalid_request" }, 400);
    try {
      const result = await deps.backupCodes.regenerate(caller.subjectId, sid);
      if (result.ok) return c.json({ backupCodes: result.backupCodes });
      return result.reason === "reauth_required"
        ? c.json({ error: ACCOUNT_REAUTH_REQUIRED }, 403)
        : c.json({ error: result.reason }, 409);
    } catch (error) {
      deps.onFailure?.(error);
      return c.json({ error: "temporarily_unavailable" }, 503);
    }
  });

  return app;
}
