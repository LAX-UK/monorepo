export type XeroProjectorMode = "off" | "shadow" | "canary" | "live";

export type XeroProjectorOperation =
  | "payment_captured"
  | "payment_refunded"
  | "lot_invoice"
  | "payout_bill"
  | "payout_settlement";

export function parseXeroLiveOperations(raw: string | undefined): Set<XeroProjectorOperation> {
  if (!raw || raw.trim() === "") return new Set();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter((s): s is XeroProjectorOperation =>
        [
          "payment_captured",
          "payment_refunded",
          "lot_invoice",
          "payout_bill",
          "payout_settlement",
        ].includes(s),
      ),
  );
}

export function isXeroOperationLive(
  mode: XeroProjectorMode,
  operation: XeroProjectorOperation,
  liveOps: Set<XeroProjectorOperation>,
): boolean {
  if (mode === "off" || mode === "shadow") return false;
  if (liveOps.size === 0) return mode === "live";
  return liveOps.has(operation);
}

export function eventTypeToXeroOperation(eventType: string): XeroProjectorOperation | null {
  switch (eventType) {
    case "payment.captured":
      return "payment_captured";
    case "payment.refunded":
      return "payment_refunded";
    case "lot.ended":
      return "lot_invoice";
    case "payout.paid":
      return "payout_bill";
    case "payout.settlement_created":
      return "payout_settlement";
    default:
      return null;
  }
}
