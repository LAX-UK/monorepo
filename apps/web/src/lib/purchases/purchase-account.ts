import type { ScopedAccount } from "@/lib/account-scope/account-scope";

/**
 * The account a purchase request names in `X-Legal-Entity-Id`. Organisations always name theirs.
 * A person's own account is named only when the caller asks (`includePersonal`), as reporting a
 * problem does; every other purchase action sends no account for a person, as it always has.
 */
export function purchaseRequestAccountId(
  account: ScopedAccount,
  options: { includePersonal?: boolean } = {},
): string | null {
  if (account.kind === "organisation") return account.id;
  return options.includePersonal ? account.id : null;
}
