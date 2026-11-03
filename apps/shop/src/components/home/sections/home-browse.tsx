import { SHOP_HOME_CONTENT } from "@/content/home/shop-home-content";
import { type HomeBrowseRowVm, editionCountLabel } from "@/lib/home/home-browse-paths";
import { MarketingArrowRightIcon } from "@auction/marketing-ui";
import Link from "next/link";

/** "Browse by" rows with counts: the ways into the catalogue, under the first screen. */
export function HomeBrowseSection({ rows }: { rows: readonly HomeBrowseRowVm[] }) {
  if (rows.length === 0) return null;
  const label = SHOP_HOME_CONTENT.hero.browseByLabel;
  return (
    <nav className="shop-home-browse" aria-label={label}>
      <p className="shop-home-browse__label" aria-hidden="true">
        {label}
      </p>
      <ul className="shop-home-browse__list">
        {rows.map((row) => (
          <li key={row.key}>
            <Link
              href={row.href}
              className="shop-home-browse__row shop-focus-ring"
              aria-label={`${row.label}, ${editionCountLabel(row.count)}`}
            >
              <span className="shop-home-browse__name">{row.label}</span>
              <span className="shop-home-browse__count" aria-hidden="true">
                {row.count}
                <MarketingArrowRightIcon className="shop-home-browse__icon" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
