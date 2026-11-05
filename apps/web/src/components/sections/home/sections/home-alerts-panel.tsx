import type { HomeAlertThumbnail } from "@/lib/home-sections/types";
import { HOME_ALERTS_ANCHOR } from "@/lib/marketing-cover/cover-alerts-outcome";
import { MARKETING_PAGE_SHELL } from "@/lib/marketing/chrome";
import { MarketingSplitFeature } from "@auction/marketing-ui";
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
  if (items.length === 0) return null;
  return (
    <ul className="m-0 flex list-none justify-center gap-2 p-0" data-alerts-thumbnails="">
      {items.map((item) => (
        <li
          key={item.src}
          className="h-14 w-11 overflow-hidden rounded-lax-control bg-surface-container"
        >
          <img
            src={item.src}
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
 * The sale-alerts panel. It is the same panel LAX Shop uses for release alerts (the shared split
 * feature, centred, on the feature tone); only the words, the form and the accent differ.
 */
export function HomeAlertsPanel({ title, body, action, thumbnails }: Props) {
  return (
    <div id={HOME_ALERTS_ANCHOR} className="scroll-mt-[var(--header-height,4rem)] pt-16 md:pt-24">
      <div className={MARKETING_PAGE_SHELL}>
        <MarketingSplitFeature
          tone="feature"
          className="overflow-hidden rounded-lax-card [&>div]:py-10 md:[&>div]:py-14"
          eyebrow="Sale alerts"
          title={title}
          body={
            <div className="flex flex-col items-center gap-5">
              <Thumbnails items={thumbnails} />
              <p className="m-0">{body}</p>
            </div>
          }
          action={action}
        />
      </div>
    </div>
  );
}
