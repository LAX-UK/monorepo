import type { ArtAccountDestinationVm } from "@/lib/account/account-nav.vm";
import { MarketingArrowUpRightIcon, MarketingViewAllChevron } from "@auction/marketing-ui";
import { ListRow } from "@auction/ui/components/list-row";

/**
 * The overview's rows: lax.art pages with a chevron, LAX Account pages with an outward arrow and
 * a screen-reader note that they open another LAX product.
 */
export function ArtAccountDestinationList({
  destinations,
}: {
  destinations: readonly ArtAccountDestinationVm[];
}) {
  return (
    <ul
      aria-label="Your account"
      data-testid="art-account-destinations"
      className="overflow-hidden rounded-lg border border-border-hairline"
    >
      {destinations.map((destination) => (
        <li key={destination.id}>
          <ListRow
            title={
              <>
                {destination.title}
                {destination.external ? <span className="sr-only"> (LAX Account)</span> : null}
              </>
            }
            subtitle={destination.subtitle}
            value={destination.countLabel}
            href={destination.href}
            className="min-h-16 gap-4 sm:px-6"
            trailing={
              destination.external ? (
                <MarketingArrowUpRightIcon className="size-4 text-on-surface-variant" />
              ) : (
                <MarketingViewAllChevron className="size-4 text-on-surface-variant" />
              )
            }
          />
        </li>
      ))}
    </ul>
  );
}
