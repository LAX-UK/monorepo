/**
 * What the settlement page says after a run. The redirect carries one of these codes, never
 * text, so a crafted link cannot put its own words on a staff page. Every message is fixed here.
 */
export const SETTLEMENT_RESULTS = {
  started: { tone: "success", message: "Settlement run started successfully." },
  missing_seller: { tone: "error", message: "Select a seller before running settlement." },
  not_permitted: {
    tone: "error",
    message: "Your role does not allow running a settlement.",
  },
  blocked: {
    tone: "error",
    message:
      "The settlement could not run for this seller. Check their payout readiness and captured payments, then try again.",
  },
  failed: {
    tone: "error",
    message: "The settlement could not be completed. Try again, or contact support if it persists.",
  },
} as const;

export type SettlementResultCode = keyof typeof SETTLEMENT_RESULTS;

export const SETTLEMENT_RESULT_PARAM = "result";

export function isSettlementResultCode(value: unknown): value is SettlementResultCode {
  return typeof value === "string" && Object.hasOwn(SETTLEMENT_RESULTS, value);
}

/** The settlement page URL that shows this result once. */
export function settlementResultHref(code: SettlementResultCode): string {
  return `/admin/payouts/settlement?${SETTLEMENT_RESULT_PARAM}=${code}`;
}

/** Client errors from the API mean the run was refused; anything else is a failure to retry. */
export function settlementResultForStatus(status: number): SettlementResultCode {
  return status >= 400 && status < 500 ? "blocked" : "failed";
}
