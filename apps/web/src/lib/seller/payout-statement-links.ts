/** The address of a payout's statement PDF, which the dashboard route serves. */
export function payoutStatementHref(legalEntityId: string, payoutId: string): string {
  return `/legal-entities/${encodeURIComponent(legalEntityId)}/payouts/${encodeURIComponent(payoutId)}/statement`;
}

/** The page a failed statement download lands on; its "Try again" is the statement address. */
export function payoutStatementUnavailableHref(legalEntityId: string, payoutId: string): string {
  return `${payoutStatementHref(legalEntityId, payoutId)}/unavailable`;
}
