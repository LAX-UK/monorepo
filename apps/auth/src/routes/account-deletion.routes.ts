import {
  ACCOUNT_DELETION_CANCEL_PATH,
  ACCOUNT_DELETION_CONFIRMATION_PHRASE,
  ACCOUNT_DELETION_PATH,
  ACCOUNT_DELETION_REQUEST_PATH,
  ACCOUNT_REAUTH_REQUIRED,
} from "@auction/identity-contracts";
import { type Context, Hono } from "hono";
import type { AccountDeletionService } from "../services/account-deletion.service.js";
import { type AccountCallerDeps, authenticateAccountCaller } from "./account-caller.js";

export type AccountDeletionRouteDeps = Omit<AccountCallerDeps, "rateLimit"> & {
  deletion: Pick<AccountDeletionService, "status" | "requestDeletionWithStepUp" | "cancelDeletion">;
  /** Budget for reading the status; each read asks every product. */
  statusRateLimit: AccountCallerDeps["rateLimit"];
  /** Budget for requesting and cancelling. */
  changeRateLimit: AccountCallerDeps["rateLimit"];
  onFailure?: (error: unknown) => void;
};

/**
 * Lets LAX Account show whether the signed-in person can delete their account (and what is in
 * the way, per product), start the 30-day deletion, and cancel it.
 *
 * Authorisation is described on authenticateAccountCaller. Requesting deletion also carries
 * `sid` and needs a recent sign-in, and the person's typed confirmation phrase: the phrase is a
 * check against an accidental call, the sign-in is the proof it is the person. "Not eligible"
 * and "already requested" are answers, not errors, so they come back as 200 with the outcome.
 */
export function createAccountDeletionRoutes(deps: AccountDeletionRouteDeps) {
  const app = new Hono();
  const reads: AccountCallerDeps = { ...deps, rateLimit: deps.statusRateLimit };
  const changes: AccountCallerDeps = { ...deps, rateLimit: deps.changeRateLimit };

  async function guarded(c: Context, run: () => Promise<Response>): Promise<Response> {
    try {
      return await run();
    } catch (error) {
      deps.onFailure?.(error);
      return c.json({ error: "temporarily_unavailable" }, 503);
    }
  }

  app.post(ACCOUNT_DELETION_PATH, async (c) => {
    const caller = await authenticateAccountCaller(c, reads);
    if (caller instanceof Response) return caller;
    return guarded(c, async () => {
      const status = await deps.deletion.status(caller.subjectId);
      return status ? c.json(status) : c.json({ error: "invalid_token" }, 401);
    });
  });

  app.post(ACCOUNT_DELETION_REQUEST_PATH, async (c) => {
    const caller = await authenticateAccountCaller(c, changes);
    if (caller instanceof Response) return caller;
    const sid = caller.params.get("sid");
    if (!sid || caller.params.get("confirmation") !== ACCOUNT_DELETION_CONFIRMATION_PHRASE) {
      return c.json({ error: "invalid_request" }, 400);
    }
    return guarded(c, async () => {
      const result = await deps.deletion.requestDeletionWithStepUp(caller.subjectId, sid);
      if (!result.ok) return c.json({ error: ACCOUNT_REAUTH_REQUIRED }, 403);
      return result.outcome ? c.json(result.outcome) : c.json({ error: "invalid_token" }, 401);
    });
  });

  app.post(ACCOUNT_DELETION_CANCEL_PATH, async (c) => {
    const caller = await authenticateAccountCaller(c, changes);
    if (caller instanceof Response) return caller;
    const sid = caller.params.get("sid");
    if (!sid) return c.json({ error: "invalid_request" }, 400);
    return guarded(c, async () => {
      const result = await deps.deletion.cancelDeletion(caller.subjectId, sid);
      return result.ok
        ? c.json({ outcome: result.outcome })
        : c.json({ error: ACCOUNT_REAUTH_REQUIRED }, 403);
    });
  });

  return app;
}
