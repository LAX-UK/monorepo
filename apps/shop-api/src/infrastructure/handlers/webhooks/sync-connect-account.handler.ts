import type { ShopConnectGateway } from "../../../application/ports/shop-connect.gateway.js";
import type { ShopPayeeConnectAccountRepository } from "../../drizzle-shop-payee-connect-account.repository.js";

export type ConnectAccountSyncOutcome = "applied" | "orphan" | "ignored";

function accountIdFromEvent(event: unknown): string | null {
  if (!event || typeof event !== "object") return null;
  const { type, data } = event as { type?: unknown; data?: { object?: { id?: unknown } } };
  if (type !== "account.updated") return null;
  const id = data?.object?.id;
  return typeof id === "string" && id.startsWith("acct_") ? id : null;
}

/** `account.updated` → refresh cached readiness from Stripe's current state of the account. */
export function createSyncConnectAccountHandler(deps: {
  gateway: ShopConnectGateway;
  accounts: ShopPayeeConnectAccountRepository;
}): (event: unknown) => Promise<ConnectAccountSyncOutcome> {
  return async (event) => {
    const stripeAccountId = accountIdFromEvent(event);
    if (!stripeAccountId) return "ignored";
    const flags = await deps.gateway.retrieveAccountFlags(stripeAccountId);
    return (await deps.accounts.applyFlags(flags)) ? "applied" : "orphan";
  };
}
