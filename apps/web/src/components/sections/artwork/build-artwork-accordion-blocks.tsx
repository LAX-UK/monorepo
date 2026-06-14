import {
  ARTWORK_PAGE_ACCORDION_IDS,
  type AccordionBlock,
  mapLotToAccordionBlocks,
} from "@/components/sections/artwork/artwork-view-models";
import { BidHistoryInAccordion } from "@/components/sections/artwork/redesign/bid-history-in-accordion";
import { LotDetailsInline } from "@/components/sections/artwork/redesign/lot-details-inline";
import { getMinNextBidAmount } from "@/lib/bid/lot-min-bid";
import type { PublicUser } from "@/lib/data/contracts";
import type { LotDocumentPublicRow } from "@/lib/data/lot-documents-public";
import type { Lot } from "@auction/types";
import Link from "next/link";

/** Marketing accordion plus “Lot details” and “Bid history” (rich nodes).
 * Use from the artwork page (RSC); `BidHistoryInAccordion` is a client child.
 */
export function buildArtworkPageAccordionBlocks(args: {
  lot: Lot;
  artist: PublicUser | null;
  documents?: LotDocumentPublicRow[];
}): AccordionBlock[] {
  const { lot, artist, documents = [] } = args;
  const minNext = getMinNextBidAmount(lot, lot.currentPrice).toFixed(2);
  const saleEndLocal = new Date(lot.endTime).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const documentsBlock: AccordionBlock | null =
    documents.length === 0
      ? null
      : {
          id: ARTWORK_PAGE_ACCORDION_IDS.documents,
          title: "Documents",
          hidden: false,
          contentNode: (
            <ul className="list-none space-y-3">
              {documents.map((d) => (
                <li key={d.id} className="font-body text-sm">
                  <a
                    href={d.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-link underline-offset-4 hover:underline"
                  >
                    {d.label?.trim() || d.kind.replaceAll("_", " ")}
                    <span className="sr-only"> (opens in new tab)</span>
                  </a>
                  <span className="ml-2 text-on-surface-variant">· {d.kind}</span>
                </li>
              ))}
            </ul>
          ),
        };

  const bpPct = ((Number(lot.buyerPremiumRate) || 0) * 100).toFixed(0);
  const feesBlock: AccordionBlock = {
    id: ARTWORK_PAGE_ACCORDION_IDS.fees,
    title: "Fees & buyer's premium",
    hidden: false,
    contentNode: (
      <div className="space-y-3 text-sm leading-relaxed text-on-surface-variant">
        <p>
          Buyer&apos;s premium: <span className="font-medium text-on-surface">{bpPct}%</span> on the
          hammer (excluding VAT, where applicable).
        </p>
        <p>
          Import duties, resale royalties, and other charges may apply depending on jurisdiction and
          the nature of the work.
        </p>
        <div className="flex flex-wrap gap-4 pt-1">
          <Link
            href="/terms"
            className="font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-link underline-offset-4 hover:underline"
          >
            Conditions of Business
          </Link>
          <Link
            href="/faq"
            className="font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-link underline-offset-4 hover:underline"
          >
            FAQ
          </Link>
        </div>
      </div>
    ),
  };

  return [
    ...mapLotToAccordionBlocks(lot, artist),
    ...(documentsBlock ? [documentsBlock] : []),
    feesBlock,
    {
      id: "lot-details",
      title: "Lot details",
      hidden: false,
      contentNode: (
        <LotDetailsInline
          lot={lot}
          minNextBid={minNext}
          saleEndLocalLabel={saleEndLocal}
          currentPrice={lot.currentPrice}
          variant="accordion"
        />
      ),
    },
    {
      id: "bid-history",
      title: "Bid history",
      hidden: false,
      contentNode: <BidHistoryInAccordion lotId={lot.id} />,
    },
  ];
}
