/**
 * Packing checks that the print in hand is the print the order was sold. The label code on the
 * stock label is scanned, or what is written on the print (such as "7/24") is typed.
 */

export type ExpectedPrint = {
  editionId: string;
  label: string;
  labelCode: string | null;
  ownerPartyId: string | null;
};

export type PackCandidate = {
  editionId: string;
  label: string;
  labelCode: string | null;
  ownerPartyId: string | null;
  /** Authorised and not reserved, sold or held: free to be sent in place of the expected print. */
  freeToSell: boolean;
};

export type ScannedPrint = { source: "label_code" | "typed_label"; value: string };

export type PackConfirmation =
  | { outcome: "match"; label: string }
  | { outcome: "wrong_print"; reason: string; scannedLabel: string | null }
  | { outcome: "swap_allowed"; to: PackCandidate; reason: string }
  | { outcome: "swap_needs_admin"; to: PackCandidate; reason: string };

function normalise(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function isSame(
  scanned: ScannedPrint,
  print: { label: string; labelCode: string | null },
): boolean {
  const value = normalise(scanned.value);
  if (value === "") return false;
  return scanned.source === "label_code"
    ? print.labelCode !== null && normalise(print.labelCode) === value
    : normalise(print.label) === value;
}

/**
 * Decides what packing does next. A matching print is confirmed. A different print that is free
 * may be sent instead when the same party owns it (the payout does not change); a print owned by
 * someone else needs a shop admin, who re-points the seller and the pending payout.
 */
export function confirmPackedPrint(
  expected: ExpectedPrint,
  scanned: ScannedPrint,
  candidates: readonly PackCandidate[],
): PackConfirmation {
  if (isSame(scanned, expected)) return { outcome: "match", label: expected.label };

  const found = candidates.find(
    (candidate) => candidate.editionId !== expected.editionId && isSame(scanned, candidate),
  );
  if (!found) {
    return {
      outcome: "wrong_print",
      scannedLabel: null,
      reason: `That is not a print this order can use. The order is for ${expected.label}`,
    };
  }
  if (!found.freeToSell) {
    return {
      outcome: "wrong_print",
      scannedLabel: found.label,
      reason: `This is ${found.label}, which is not free to send. The order is for ${expected.label}`,
    };
  }
  const sameOwner = expected.ownerPartyId !== null && found.ownerPartyId === expected.ownerPartyId;
  return sameOwner
    ? {
        outcome: "swap_allowed",
        to: found,
        reason: `${found.label} has the same owner as ${expected.label}, so the payout does not change`,
      }
    : {
        outcome: "swap_needs_admin",
        to: found,
        reason: `${found.label} has a different owner from ${expected.label}. A shop admin must move the seller and the pending payout`,
      };
}
