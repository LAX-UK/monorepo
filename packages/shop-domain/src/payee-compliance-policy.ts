export type PayeeComplianceStatus = "verified" | "not_required" | "pending" | "blocked" | "missing";

export function isPayeeComplianceEligible(status: PayeeComplianceStatus): boolean {
  return status === "verified" || status === "not_required";
}

export function resolvePayeeComplianceStatus(
  row: { status: "verified" | "not_required" | "pending" | "blocked" } | undefined,
): PayeeComplianceStatus {
  if (!row) {
    return "missing";
  }
  return row.status;
}
