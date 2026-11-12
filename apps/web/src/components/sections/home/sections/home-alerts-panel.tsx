import { BidResponsiveImg } from "@/components/media/bid-responsive-img";
import type { HomeAlertThumbnail } from "@/lib/home-sections/types";
import { HOME_ALERTS_ANCHOR } from "@/lib/marketing-cover/cover-alerts-outcome";
import { MARKETING_PAGE_SHELL } from "@/lib/marketing/chrome";
import { bidThumbSrcSet } from "@/lib/media/bid-image-src-set";
import { MarketingSplitFeature } from "@auction/marketing-ui/marketing-split-feature";
import type { ReactNode } from "react";

type Props = {
  title: string;
  body: ReactNode;
  /** The form, or the buttons of the signed-in states. */
  action: ReactNode;
  thumbnails: readonly HomeAlertThumbnail[];
};

/** Three small works from recent sales: what the emails are about, never a large picture. */
function Thumbnails({ items }: { items: readonly HomeAlertThumbnail[] }) {
  return (
    <ul className="m-0 flex list-none gap-2 p-0" data-alerts-thumbnails="">
      {items.map((item) => (
        <li
          key={item.src}
          className="h-14 w-11 overflow-hidden rounded-lax-control bg-surface-container md:h-[72px] md:w-14"
        >
          <BidResponsiveImg
            src={item.src}
            srcSet={bidThumbSrcSet(item.src)}
            sizes="(min-width: 768px) 56px, 44px"
            alt=""
            loading="lazy"
            decoding="async"
            className="size-full object-cover"
          />
        </li>
      ))}
    </ul>
  );
}

/**
 * The sale-alerts panel: the shared split feature in its compact row (the family's prompt
 * panel, as in LAX Shop), with three recent works at the start. Only the words, the form and
 * the accent differ between products.
 */
export function HomeAlertsPanel({ title, body, action, thumbnails }: Props) {
  return (
    <div id={HOME_ALERTS_ANCHOR} className="scroll-mt-[var(--header-height,4rem)] pt-16 md:pt-24">
      <div className={MARKETING_PAGE_SHELL}>
        <MarketingSplitFeature
          compact
          tone="feature"
          className="overflow-hidden rounded-lax-card"
          title={title}
          body={body}
          {...(thumbnails.length > 0 ? { leading: <Thumbnails items={thumbnails} /> } : {})}
          action={action}
        />
      </div>
    </div>
  );
}
