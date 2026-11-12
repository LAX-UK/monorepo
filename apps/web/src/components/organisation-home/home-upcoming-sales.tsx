import { MediaImage } from "@/components/ui/media-image";
import type { UpcomingSaleView } from "@/lib/organisation-home/organisation-dashboard-view";
import { LiveBadge } from "@auction/ui/components/live-badge";
import { StatusBadge } from "@auction/ui/lax/status-badge";
import Link from "next/link";
import { HomeSection } from "./home-section";

type Props = {
  sales: readonly UpcomingSaleView[];
  seeAllHref: string;
};

/** The works on a card's mat: up to three, side by side, or the placeholder when none has a photo. */
function SaleMat({ sale }: { sale: UpcomingSaleView }) {
  return (
    <div className="relative flex h-36 items-end justify-center gap-3 bg-lax-paper px-6 py-5 sm:h-44 sm:px-8 lg:h-48">
      {(sale.images.length > 0 ? sale.images : [null]).map((src) => (
        <div key={src ?? "none"} className="relative h-full max-w-56 min-w-0 flex-1 basis-0">
          <MediaImage
            src={src}
            alt=""
            placeholderTitle={sale.title}
            sizes="224px"
            className="size-full"
            imgClassName="object-contain object-bottom"
          />
        </div>
      ))}
      {sale.live ? (
        <LiveBadge className="absolute top-3 left-3 bg-lax-surface! ring-1 ring-lax-line" />
      ) : null}
    </div>
  );
}

/**
 * The next sales with the organisation's works, as cards: the works on a paper mat, the title,
 * when the sale opens or, while it is live, when it closes, and how many of the works are in it.
 * Two across in the column; a row to swipe on phones.
 */
export function HomeUpcomingSales({ sales, seeAllHref }: Props) {
  if (sales.length === 0) return null;
  return (
    <HomeSection
      id="home-upcoming-sales"
      title="Upcoming sales"
      link={{ href: seeAllHref, label: "All sales" }}
    >
      <ul
        aria-labelledby="home-upcoming-sales"
        className="-mx-4 grid snap-x snap-mandatory auto-cols-[17.5rem] grid-flow-col gap-4 overflow-x-auto scroll-px-4 px-4 [scrollbar-width:none] sm:mx-0 sm:auto-cols-auto sm:grid-flow-row sm:grid-cols-2 sm:overflow-visible sm:px-0"
      >
        {sales.map((sale) => (
          <li key={sale.id} className="snap-start">
            <Link
              href={sale.href}
              className="block h-full overflow-hidden rounded-lax-card border border-lax-line bg-lax-surface transition-colors duration-150 hover:border-lax-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lax-focus"
            >
              <SaleMat sale={sale} />
              <span className="block px-5 pt-4 pb-5">
                <span className="block font-lax-display text-lax-16 font-semibold text-lax-fg">
                  {sale.title}
                </span>
                <time dateTime={sale.dateTime} className="mt-0.5 block text-lax-13 text-lax-muted">
                  {sale.timing}
                </time>
                <StatusBadge tone="info" shape="dot" className="mt-3">
                  {sale.works}
                </StatusBadge>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </HomeSection>
  );
}
