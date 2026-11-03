import type { StatementView } from "@/lib/data/http/organisation-profile.types";
import { formatMoney } from "@/lib/format-currency";
import { formatPeriod } from "@/lib/ui/format";

/** One statement in the Documents library. */
export type StatementDocumentRow = {
  payoutId: string;
  /** "Payout statement": short, so it stays on one line in a narrow list. */
  title: string;
  /** The period it covers: "1 Oct 2026 → 31 Oct 2026". */
  period: string;
  /** The amount paid out: "£12,860.00". */
  detail: string;
  /** When the PDF can't be made; the row then says so instead of offering a download. */
  unavailable: boolean;
  /** Where the PDF downloads (made on the first request, then kept). */
  href: string;
};

/** The statement PDF, through the Bid app (the API needs the signed-in session). */
export function statementPdfHref(legalEntityId: string, payoutId: string): string {
  return `/legal-entities/${encodeURIComponent(legalEntityId)}/payouts/${encodeURIComponent(payoutId)}/statement`;
}

/** The organisation's statements as the library lists them, in the order the API gives. */
export function statementDocumentRows(
  legalEntityId: string,
  statements: readonly StatementView[],
): StatementDocumentRow[] {
  return statements.map((statement) => ({
    payoutId: statement.payoutId,
    title: "Payout statement",
    period: formatPeriod(statement.periodStart, statement.periodEnd),
    detail: formatMoney(statement.netAmount, statement.currency),
    unavailable: statement.availability === "unavailable",
    href: statementPdfHref(legalEntityId, statement.payoutId),
  }));
}
