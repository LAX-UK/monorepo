import { ShopWorkMat } from "@/components/media/shop-work-mat";
import { ShopCommerceButton } from "@/components/shop-commerce-button";
import { SHOP_HOME_CONTENT } from "@/content/home/shop-home-content";
import { type HomeBrowseRowVm, editionCountLabel } from "@/lib/home/home-browse-paths";
import type { HomeHeroVm } from "@/lib/home/home-page.vm";
import { MarketingArrowRightIcon, MarketingSplitFeature } from "@auction/marketing-ui";
import Link from "next/link";

function BrowseRows({ rows }: { rows: readonly HomeBrowseRowVm[] }) {
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

/**
 * The first screen, on the shared split feature: the release whole on its mat beside what the
 * Shop sells, one action to the catalogue, the release itself, and "Browse by" rows with counts.
 * With nothing on sale it is a text-only split that says new editions are on their way.
 */
export function HomeHero({ hero }: { hero: HomeHeroVm }) {
  const release = hero.release;
  return (
    <MarketingSplitFeature
      className="shop-home-feature shop-home-hero"
      tone="plain"
      headingLevel="h1"
      mediaSide="left"
      eyebrow={hero.eyebrow ? <span className="shop-home-eyebrow">{hero.eyebrow}</span> : null}
      title={hero.title}
      body={
        <>
          <p className="shop-home-hero__lead">{hero.lead}</p>
          {release ? <p className="shop-home-hero__now">{release.line}</p> : null}
        </>
      }
      {...(release
        ? {
            media: (
              <Link
                href={release.href}
                className="shop-home-feature__media"
                tabIndex={-1}
                aria-hidden="true"
              >
                <ShopWorkMat
                  src={release.imageUrl}
                  alt={release.imageAlt}
                  sizes="(min-width: 48rem) 40vw, 90vw"
                  priority
                  className="shop-home-feature__mat"
                />
              </Link>
            ),
          }
        : {})}
      action={
        <div className="shop-home-hero__actions">
          {hero.primary ? (
            <ShopCommerceButton href={hero.primary.href}>{hero.primary.label}</ShopCommerceButton>
          ) : null}
          {hero.workLink ? (
            <Link href={hero.workLink.href} className="shop-home-more shop-focus-ring">
              {hero.workLink.label}
              <MarketingArrowRightIcon className="shop-home-more__icon" />
            </Link>
          ) : null}
          {hero.emptyAction ? (
            <ShopCommerceButton href={hero.emptyAction.href} variant="outline" scale="standard">
              {hero.emptyAction.label}
            </ShopCommerceButton>
          ) : null}
          <BrowseRows rows={hero.browseRows} />
        </div>
      }
    />
  );
}
