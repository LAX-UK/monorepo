import type { ScopedAccount } from "@/lib/account-scope/account-scope";

/**
 * The account a purchase request names in `X-Legal-Entity-Id`: the account in use, a person's own
 * included, because the purchase endpoints act for an explicit account. Null only when a person's
 * own account is not yet known.
 */
export function purchaseRequestAccountId(account: ScopedAccount): string | null {
  return account.id;
}
