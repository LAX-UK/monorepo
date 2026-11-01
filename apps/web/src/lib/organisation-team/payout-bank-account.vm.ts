import type { PayoutBankAccountView } from "@/lib/data/http/organisation-profile.types";

/** Letters kept as capitals when a bank's name arrives in upper case. */
const ACRONYMS = new Set(["PLC", "UK", "HSBC", "TSB", "RBS", "NA", "AG", "SA", "NV", "BNP"]);

/**
 * A bank's name in the product's sentence style: banks often report it in capitals
 * ("BARCLAYS BANK PLC"), which reads as shouting, so a name in capitals is title-cased.
 */
export function bankNameLabel(name: string): string {
  if (name !== name.toUpperCase()) return name;
  return name
    .split(/\s+/)
    .map((word) => (ACRONYMS.has(word) ? word : `${word.charAt(0)}${word.slice(1).toLowerCase()}`))
    .join(" ");
}

/** "Barclays Bank PLC ending 0042"; the bank alone or "Account ending 0042" when one is missing. */
export function payoutBankLine(account: PayoutBankAccountView): string {
  const bank = account.bankName ? bankNameLabel(account.bankName) : null;
  const ending = account.last4 ? `ending ${account.last4}` : null;
  if (bank && ending) return `${bank} ${ending}`;
  if (ending) return `Account ${ending}`;
  return bank ?? "Bank account";
}

/** The line with its currency: "Barclays Bank PLC ending 0042 · GBP". */
export function payoutBankLineWithCurrency(account: PayoutBankAccountView): string {
  return [payoutBankLine(account), account.currency].filter(Boolean).join(" · ");
}
