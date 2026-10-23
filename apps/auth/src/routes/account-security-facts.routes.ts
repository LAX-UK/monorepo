import {
  ACCOUNT_SECURITY_FACTS_PATH,
  type AccountSecurityFactsResponse,
} from "@auction/identity-contracts";
import { Hono } from "hono";
import { type AccountCallerDeps, authenticateAccountCaller } from "./account-caller.js";

export type AccountSecurityFactsRouteDeps = AccountCallerDeps & {
  facts: { read(subjectId: string): Promise<AccountSecurityFactsResponse | null> };
  onReadFailure?: (error: unknown) => void;
};

/**
 * Lets LAX Account read the signed-in person's own security state (is two-step verification
 * on, how many backup codes are left).
 *
 * Why a client-authenticated route rather than ID-token claims: the answer must be live. An
 * ID token is minted at sign-in, so a person who turns two-step verification on afterwards
 * would keep seeing "Off" in Account until they signed in again.
 *
 * Authorisation is described on authenticateAccountCaller.
 */
export function createAccountSecurityFactsRoutes(deps: AccountSecurityFactsRouteDeps) {
  const app = new Hono();

  app.post(ACCOUNT_SECURITY_FACTS_PATH, async (c) => {
    const caller = await authenticateAccountCaller(c, deps);
    if (caller instanceof Response) return caller;

    try {
      const facts = await deps.facts.read(caller.subjectId);
      if (!facts) return c.json({ error: "invalid_token" }, 401);
      // Picked field by field so a future reader that returns more can never widen the response.
      return c.json({
        twoFactorEnabled: facts.twoFactorEnabled,
        backupCodesRemaining: facts.backupCodesRemaining,
      });
    } catch (error) {
      deps.onReadFailure?.(error);
      return c.json({ error: "temporarily_unavailable" }, 503);
    }
  });

  return app;
}
