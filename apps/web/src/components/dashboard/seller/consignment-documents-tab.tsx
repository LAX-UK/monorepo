import type { ConsignmentDocumentsView } from "@/lib/seller/consignment-documents";
import { PAYOUT_READERS } from "@/lib/seller/payout-readers";
import { ButtonLink, EmptyState, FileAttachment, Notice } from "@auction/ui/lax";
import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  view: ConsignmentDocumentsView;
  /** Some of LAX's files could not be read; the rest still show. */
  failed: boolean;
  /** Where "Try again" leads: this tab again. */
  retryHref: string;
  /** The seller's own documents, when that panel has something to show. */
  sellerDocuments: ReactNode | null;
};

const CARD = "rounded-lax-card border border-lax-line bg-lax-surface";

/**
 * The consignment's Documents tab: the files LAX keeps for the work (the agreement, condition
 * reports and the payout statement), then the documents the seller sent with it. With nothing
 * on either side it says what will arrive here, and when.
 */
export function ConsignmentDocumentsTab({ view, failed, retryHref, sellerDocuments }: Props) {
  const failure = failed ? (
    <Notice
      tone="warning"
      title="Some documents couldn't be loaded"
      actions={
        <ButtonLink href={retryHref} Link={Link} size="sm">
          Try again
        </ButtonLink>
      }
    >
      The ones below are safe to open.
    </Notice>
  ) : null;

  if (view.fromLax.length === 0 && !view.statementHidden && !sellerDocuments) {
    return (
      <div className="flex flex-col gap-4">
        {failure}
        <section className={CARD} aria-label="Documents">
          <EmptyState
            illustration="ledger"
            title="No documents yet"
            description="The agreement, the condition report and the payout statement for this work arrive here as we send them."
          />
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {failure}
      <section aria-labelledby="lax-documents-heading" className={CARD}>
        <div className="px-4 pt-5 pb-4 sm:px-6">
          <h2
            id="lax-documents-heading"
            className="font-lax-display text-lax-18 font-semibold text-lax-fg"
          >
            From LAX
          </h2>
          <p className="mt-1 text-lax-14 leading-5 text-lax-muted">
            The agreement, condition report and statement for this work, to open or keep.
          </p>
        </div>
        {view.fromLax.length > 0 ? (
          <ul aria-label="Files from LAX" className="flex flex-col gap-2 px-4 pb-5 sm:px-6">
            {view.fromLax.map((row) => (
              <li key={row.id}>
                <FileAttachment
                  name={row.name}
                  href={row.href}
                  kind={row.kind}
                  size={row.size}
                  note={row.note}
                  className="w-full"
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mx-4 mb-5 rounded-lax-card bg-lax-sunken px-4 py-3 text-lax-14 leading-5 text-lax-fg sm:mx-6">
            The agreement arrives here once your specialist sets its terms.
          </p>
        )}
        {view.statementHidden ? (
          <p className="border-t border-lax-line-subtle px-4 py-4 text-lax-13 leading-5 text-lax-muted sm:px-6">
            Only {PAYOUT_READERS} sees the payout statement.
          </p>
        ) : null}
      </section>
      {sellerDocuments}
    </div>
  );
}
