/**
 * Statements an organisation can download from its document library. Every payout has a
 * statement: the PDF of its lots, deductions and net amount. It is made the first time someone
 * asks for it and kept, so a statement is either ready, made on request, or could not be made
 * (and LAX has been told).
 *
 * Payout statements are the only statements the platform issues; there are no monthly ones.
 */

export type StatementKind = "payout";

export type StatementAvailability = "ready" | "on_request" | "unavailable";

export type StatementSource = {
  statementUrl: string | null;
  statementGenerationError: string | null;
};

export function statementAvailability(source: StatementSource): StatementAvailability {
  if (source.statementGenerationError) return "unavailable";
  return source.statementUrl ? "ready" : "on_request";
}

/** The newest statements first: by the end of the period they cover, then when they were made. */
export function compareStatementsNewestFirst(
  a: { periodEnd: Date; createdAt: Date },
  b: { periodEnd: Date; createdAt: Date },
): number {
  return (
    b.periodEnd.getTime() - a.periodEnd.getTime() || b.createdAt.getTime() - a.createdAt.getTime()
  );
}
