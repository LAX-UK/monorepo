import { HomeFramedPrint } from "@/components/home/home-framed-print.client";
import { ShopCommerceButton } from "@/components/shop-commerce-button";
import { type HomeQuickFilterVm, editionCountLabel } from "@/lib/home/home-browse-paths";
import type { HomeHeroVm } from "@/lib/home/home-page.vm";
import { MarketingArrowRightIcon } from "@auction/marketing-ui";
import Link from "next/link";

function QuickFilters({ filters }: { filters: readonly HomeQuickFilterVm[] }) {
  if (filters.length === 0) return null;
  return (
    <nav className="shop-home-hero__filters" aria-label="Quick filters">
      <ul className="shop-quick-filters">
        {filters.map((filter) => (
          <li key={filter.key}>
            <Link
              href={filter.href}
              className="shop-quick-filter shop-focus-ring"
              aria-label={`${filter.label}, ${editionCountLabel(filter.count)}`}
            >
              {filter.label}
              <span className="shop-quick-filter__count" aria-hidden="true">
                {filter.count}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * The first screen, on the gallery's paper wall: what Shop sells, one action to the catalogue and
 * quick ways in, beside one release hung like a print with its museum label.
 */
export function HomeHero({
  hero,
  quickFilters,
}: {
  hero: HomeHeroVm;
  quickFilters: readonly HomeQuickFilterVm[];
}) {
  const release = hero.release;
  return (
    <section
      className="shop-home-hero"
      data-has-release={release ? "true" : "false"}
      aria-labelledby="home-hero-heading"
    >
      <div className="shop-home-hero__copy">
        {hero.eyebrow ? <p className="shop-home-eyebrow">{hero.eyebrow}</p> : null}
        <h1 id="home-hero-heading" className="shop-home-hero__title">
          {hero.title}
        </h1>
        <p className="shop-home-hero__lead">{hero.lead}</p>
        <div className="shop-home-hero__actions">
          <ShopCommerceButton href={hero.primary.href}>{hero.primary.label}</ShopCommerceButton>
          {hero.workLink ? (
            <Link href={hero.workLink.href} className="shop-home-more shop-focus-ring">
              {hero.workLink.label}
              <MarketingArrowRightIcon className="shop-home-more__icon" />
            </Link>
          ) : null}
        </div>
        <QuickFilters filters={quickFilters} />
      </div>

      {release ? (
        <figure className="shop-home-hero__release">
          <Link
            href={release.href}
            className="shop-home-hero__print-link"
            tabIndex={-1}
            aria-hidden="true"
          >
            <HomeFramedPrint src={release.imageUrl} alt={release.imageAlt} />
          </Link>
          <figcaption className="shop-home-label">
            <span className="shop-home-label__artist">{release.artistName}</span>
            <span className="shop-home-label__price">{release.priceLabel}</span>
            <span className="shop-home-label__title">{release.titleLine}</span>
            <span className="shop-home-label__edition">{release.editionLine}</span>
            {release.factsLine ? (
              <span className="shop-home-label__facts">{release.factsLine}</span>
            ) : null}
          </figcaption>
        </figure>
      ) : null}
    </section>
  );
}
