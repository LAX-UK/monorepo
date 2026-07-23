import { formatEstimateRange } from "@/lib/money/currency";
import { formatMoney } from "@/lib/ui/format";

export type AdminTableMoneyDisplay = {
  primary: string;
  secondary?: string;
};

export type FormatAdminTableMoneyOptions = {
  emptyLabel?: string;
  treatZeroAsEmpty?: boolean;
};

function isEmptyAmount(
  amount: string | number | null | undefined,
  treatZeroAsEmpty: boolean,
): boolean {
  if (amount == null) return true;
  if (typeof amount === "string" && amount.trim() === "") return true;
  if (treatZeroAsEmpty) {
    const n = typeof amount === "string" ? Number.parseFloat(amount) : amount;
    if (!Number.isNaN(n) && n <= 0) return true;
  }
  return false;
}

/** Format a single currency amount for admin table cells. */
export function formatAdminTableMoney(
  amount: string | number | null | undefined,
  currency?: string,
  options?: FormatAdminTableMoneyOptions,
): AdminTableMoneyDisplay {
  const emptyLabel = options?.emptyLabel ?? "—";
  if (isEmptyAmount(amount, options?.treatZeroAsEmpty === true) || amount == null) {
    return { primary: emptyLabel };
  }
  return { primary: formatMoney(amount, currency) };
}

/** Format a low–high estimate range for admin table cells. */
export function formatAdminTableMoneyRange(
  low: string | null | undefined,
  high: string | null | undefined,
  currency: string,
  options?: FormatAdminTableMoneyOptions,
): AdminTableMoneyDisplay {
  const emptyLabel = options?.emptyLabel ?? "—";
  if (!low?.trim() || !high?.trim()) {
    return { primary: emptyLabel };
  }
  return { primary: formatEstimateRange({ low, high, currency }) };
}
