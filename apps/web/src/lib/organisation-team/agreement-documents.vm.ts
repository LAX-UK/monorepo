import { formatDateInline } from "@/lib/ui/format";
import type { ConsignmentAgreement } from "@auction/types";

/** One consignment agreement in the Documents library. */
export type AgreementDocumentRow = {
  submissionId: string;
  /** "Consignment agreement · Low cloud, Rye". */
  title: string;
  /** "Accepted by Maya Okafor, 29 Oct 2026". */
  detail: string;
  accepted: boolean;
  /** Where its PDF downloads. */
  href: string;
};

/** The PDF of one agreement, through the Bid app (the API needs the signed-in session). */
export function agreementPdfHref(submissionId: string): string {
  return `/organisation/documents/agreements/${encodeURIComponent(submissionId)}`;
}

/**
 * The organisation's consignment agreements, newest first: accepted ones say who accepted and
 * when; one still to accept says so. Works without a title read "A consigned work".
 */
export function agreementDocumentRows(
  agreements: readonly ConsignmentAgreement[],
  titleBySubmission: ReadonlyMap<string, string>,
): AgreementDocumentRow[] {
  return [...agreements]
    .sort(
      (a, b) =>
        new Date(b.acceptedAt ?? b.proposedAt).getTime() -
        new Date(a.acceptedAt ?? a.proposedAt).getTime(),
    )
    .map((a) => {
      const work = titleBySubmission.get(a.submissionId) ?? "A consigned work";
      const accepted = a.acceptedAt != null;
      return {
        submissionId: a.submissionId,
        title: `Consignment agreement · ${work}`,
        detail: accepted
          ? `Accepted${a.acceptedByName ? ` by ${a.acceptedByName}` : ""}, ${formatDateInline(a.acceptedAt)}`
          : `Proposed ${formatDateInline(a.proposedAt)}, waiting to be accepted`,
        accepted,
        href: agreementPdfHref(a.submissionId),
      };
    });
}
