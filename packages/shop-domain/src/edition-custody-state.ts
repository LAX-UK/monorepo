export type EditionCustodyStatus =
  | "unprinted"
  | "in_production"
  | "qc_failed"
  | "stored"
  | "in_transit"
  | "delivered"
  | "collected"
  | "with_owner"
  | "returned";

export function canTransitionCustodyStatus(
  from: EditionCustodyStatus,
  to: EditionCustodyStatus,
): boolean {
  if (from === to) return true;
  const allowed: Record<EditionCustodyStatus, readonly EditionCustodyStatus[]> = {
    unprinted: ["in_production", "with_owner"],
    in_production: ["qc_failed", "stored", "in_transit"],
    qc_failed: ["in_production"],
    stored: ["in_transit", "with_owner"],
    in_transit: ["delivered", "collected"],
    delivered: ["returned"],
    collected: ["returned"],
    with_owner: ["returned"],
    returned: ["unprinted"],
  };
  return allowed[from].includes(to);
}
