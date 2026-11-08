import "server-only";

import { getServerDataContainer } from "@/lib/data/container.server";
import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { X_LEGAL_ENTITY_ID_HEADER } from "@/lib/legal-entity/client-acting-context";
import { purchaseRequestAccountId } from "./purchase-account";

const BASE = "/legal-entities/purchases";

/**
 * Calls the purchases endpoints for the account in use: an organisation names itself, a person's
 * own account sends no account, as every purchase request does.
 */
export async function purchasesApiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const scope = await (await getServerDataContainer()).buying.scope();
  const account = purchaseRequestAccountId(scope.account);
  return authedServerFetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(account ? { [X_LEGAL_ENTITY_ID_HEADER]: account } : {}),
    },
  });
}
