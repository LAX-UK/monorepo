import { formatDateInline } from "@/lib/ui/format";
import { agreementTermsComplete } from "@auction/domain";
import type { ConsignmentAgreement, EntityDocument } from "@auction/types";
import { consignmentAgreementHref } from "./consignment-records";
import { fileSize } from "./consignment-thread";
import { payoutStatementHref } from "./sold-and-payouts.vm";

/** One file LAX keeps for the consignment, drawn as the kit's file attachment. */
export type ConsignmentDocumentRow = {
  id: string;
  /** What the file is, as it downloads: "Consignment agreement.pdf", "Payout statement.pdf". */
  name: string;
  /** When it was sent or settled, to tell two of a kind apart. */
  note: string | null;
  href: string;
  kind: "image" | "pdf";
  size: string | null;
};

export type ConsignmentDocumentsView = {
  /** The agreement, condition reports and statement, in the order the work reaches them. */
  fromLax: ConsignmentDocumentRow[];
  /**
   * The work sold but this member does not see payouts, so its statement is not listed; the tab
   * says who can see it rather than leaving it out silently.
   */
  statementHidden: boolean;
};

export type ConsignmentDocumentsSources = {
  submissionId: string;
  sellerEntityId: string | null;
  agreement: ConsignmentAgreement | null;
  /** The lot's documents; only its condition reports are the seller's to keep. */
  lotDocuments: readonly EntityDocument[];
  /** The sold lot's payout, once the money was paid out; `null` before. */
  payout: { id: string; settledAt: Date | null } | null;
  sold: boolean;
  /** The member sees the account's payouts (capability matrix). */
  canSeePayouts: boolean;
};

function fileKind(contentType: string | null): ConsignmentDocumentRow["kind"] {
  return contentType?.startsWith("image/") ? "image" : "pdf";
}

/** The files LAX keeps for one consignment, for its Documents tab. */
export function consignmentDocuments(input: ConsignmentDocumentsSources): ConsignmentDocumentsView {
  const rows: ConsignmentDocumentRow[] = [];
  const { agreement } = input;
  // Until the specialist sets the terms there is no agreement to keep.
  if (agreement && (agreement.acceptedAt || agreementTermsComplete(agreement))) {
    rows.push({
      id: "agreement",
      name: "Consignment agreement.pdf",
      note: agreement.acceptedAt
        ? `Accepted ${formatDateInline(agreement.acceptedAt)}`
        : `Sent ${formatDateInline(agreement.proposedAt)}`,
      href: consignmentAgreementHref(input.submissionId),
      kind: "pdf",
      size: null,
    });
  }
  for (const doc of input.lotDocuments) {
    if (doc.kind !== "condition_report") continue;
    // The lot's public list carries only the file's kind, label and address; the rest may be absent.
    const kind = fileKind(doc.contentType ?? null);
    const added = doc.createdAt ? new Date(doc.createdAt) : null;
    const extension =
      doc.fileName?.match(/\.([a-z0-9]{2,5})$/i)?.[1] ?? (kind === "pdf" ? "pdf" : "jpg");
    rows.push({
      id: doc.id,
      name: `Condition report.${extension.toLowerCase()}`,
      note: added && !Number.isNaN(added.getTime()) ? formatDateInline(added) : null,
      href: doc.downloadUrl,
      kind,
      size: fileSize(doc.byteSize ?? null),
    });
  }
  const payout = input.canSeePayouts ? input.payout : null;
  if (payout && input.sellerEntityId) {
    rows.push({
      id: `statement-${payout.id}`,
      name: "Payout statement.pdf",
      note: payout.settledAt ? `Paid out ${formatDateInline(payout.settledAt)}` : null,
      href: payoutStatementHref(input.sellerEntityId, payout.id),
      kind: "pdf",
      size: null,
    });
  }
  return { fromLax: rows, statementHidden: input.sold && !input.canSeePayouts };
}
