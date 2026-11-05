import type {
  AdminConfirmPrintResponse,
  AdminPickAndPack,
  AdminPickLine,
} from "@auction/shop-contracts";
import { SWAP_REASON_FIELD_MAX } from "@auction/shop-contracts";
import { formatStaffDateTime } from "@auction/staff-ui";
import { presentStatus } from "./staff-status";

/*
 * How packing reads on the order page: one row per print sold, where it is, whether it has been
 * confirmed, what its certificate needs, and what to do when the print in hand is not the one
 * sold. Pure, so the wording and the rules are tested without rendering.
 */

export const presentCertificateStatus = presentStatus("certificate");

export type PackRowView = {
  orderLineId: string;
  title: string;
  label: string;
  /** Where the print is, or that it is printed to order. */
  where: string;
  confirmed: boolean;
  /** "Confirmed by Pat on 4 Nov, 10:15", or null before packing. */
  confirmedNote: string | null;
  /** "Sent in place of 7/24" after a swap. */
  replacedNote: string | null;
  certificate: AdminPickLine["certificate"];
  /** A confirmed print with nothing left to do is shown quiet. */
  canConfirm: boolean;
  canSwap: boolean;
};

export function packWhere(line: AdminPickLine): string {
  if (line.storageLocation) return line.storageLocation;
  return line.printedToOrder ? "Print to order" : "Location not recorded";
}

export function packRowViews(pack: AdminPickAndPack): PackRowView[] {
  return pack.lines
    .filter((line) => !line.cancelled)
    .map((line) => {
      const confirmed = line.confirmedAt !== null;
      return {
        orderLineId: line.orderLineId,
        title: line.artworkTitle,
        label: line.label,
        where: packWhere(line),
        confirmed,
        confirmedNote:
          confirmed && line.confirmedAt
            ? `Confirmed${line.confirmedBy ? ` by ${line.confirmedBy}` : ""} on ${formatStaffDateTime(line.confirmedAt)}`
            : null,
        replacedNote: line.replacedLabel ? `Sent in place of ${line.replacedLabel}` : null,
        certificate: line.certificate,
        canConfirm: !confirmed && line.certificate.status !== "blocked",
        canSwap: !confirmed,
      };
    });
}

/** "2 of 3 prints confirmed", shown beside the section title. */
export function packProgress(rows: readonly PackRowView[]): string {
  const confirmed = rows.filter((row) => row.confirmed).length;
  return `${confirmed} of ${rows.length} ${rows.length === 1 ? "print" : "prints"} confirmed`;
}

export const CONFIRM_FIELD_LABEL = "What is on the print";
export const CONFIRM_FIELD_HELP =
  "Scan the stock label, or type what is written on the print, such as 7/24.";
export const CONFIRM_FIELD_EMPTY = "Scan the label or type what is written on the print.";

/** A label code is a short run of capitals and digits; anything with a slash or a space is a number. */
export function scanSource(value: string): "label_code" | "typed_label" {
  const trimmed = value.trim();
  return /^[A-Za-z0-9]{4,12}$/.test(trimmed) && /[A-Za-z]/.test(trimmed) && !/^\d+$/.test(trimmed)
    ? "label_code"
    : "typed_label";
}

export type ConfirmNotice =
  | { kind: "wrong_print"; title: string; body: string }
  | {
      kind: "swap";
      title: string;
      body: string;
      target: { editionId: string; label: string };
      /** Set when this person may not send the print, with the reason to show. */
      blockedReason: string | null;
    };

/** What staff are told when the print in hand is not the one sold, and what they can do next. */
export function confirmNotice(
  response: Exclude<AdminConfirmPrintResponse, { outcome: "confirmed" }>,
  orderedLabel: string,
  canSwapAcrossOwners: boolean,
): ConfirmNotice {
  if (response.outcome === "wrong_print") {
    return {
      kind: "wrong_print",
      title: response.scannedLabel
        ? `This is ${response.scannedLabel}. The order is for ${orderedLabel}`
        : `That is not ${orderedLabel}`,
      body: response.reason,
    };
  }
  const blocked = response.needsAdmin && !canSwapAcrossOwners;
  return {
    kind: "swap",
    title: `This is ${response.to.label}. The order is for ${orderedLabel}`,
    body: response.needsAdmin
      ? `${response.to.label} has a different owner, so sending it moves the seller and the payout.`
      : `${response.to.label} has the same owner, so the payout does not change.`,
    target: response.to,
    blockedReason: blocked ? "Only a shop admin can send a print another party owns." : null,
  };
}

export function swapReasonError(reason: string): string | null {
  const trimmed = reason.trim();
  if (!trimmed) return "Say why this print is being replaced.";
  if (trimmed.length > SWAP_REASON_FIELD_MAX) {
    return `Keep the reason to ${SWAP_REASON_FIELD_MAX} characters or fewer.`;
  }
  return null;
}

/** The sentence shown after a swap, when the buyer was or was not emailed. */
export function swapResultMessage(result: {
  label: string;
  previousLabel: string;
  buyerNotified: boolean;
}): string {
  return result.buyerNotified
    ? `Sending ${result.label} instead of ${result.previousLabel}. The buyer has been emailed.`
    : `Sending ${result.label} instead of ${result.previousLabel}.`;
}
