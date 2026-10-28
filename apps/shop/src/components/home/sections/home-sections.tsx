import { CatalogueGrid } from "@/components/catalogue-grid";
import { ShopCatalogueState } from "@/components/home/shop-empty-state";
import { ShopSection } from "@/components/layout/shop-section";
import { ShopMediaImage } from "@/components/media/shop-media-image";
import { ShopCommerceButton } from "@/components/shop-commerce-button";
import { SHOP_HOME_CONTENT } from "@/content/home/shop-home-content";
import type { HomeCollectionVm } from "@/lib/home/home-browse-paths";
import type { HomeArtistsVm, HomeNewEditionsVm, HomeStoryVm } from "@/lib/home/home-page.vm";
import { SHOP_MEDIA_LABELS } from "@/lib/media/shop-media-labels";
import {
  MarketingArrowUpRightIcon,
  MarketingArtistCard,
  MarketingArtistGrid,
} from "@auction/marketing-ui";
import Link from "next/link";

export function NewEditionsSection({
  editions,
  errorMessage,
  now,
}: {
  editions: HomeNewEditionsVm | null;
  errorMessage?: string | undefined;
  now: Date;
}) {
  if (!editions && !errorMessage) return null;
  const copy = SHOP_HOME_CONTENT.newEditions;
  return (
    <ShopSection
      id="home-editions"
      title={copy.title}
      subtitle={copy.subtitle}
      {...(editions ? { viewAll: editions.viewAll } : {})}
    >
      {editions ? (
        <CatalogueGrid
          items={editions.items}
          titleLevel={3}
          now={now}
          className="shop-home__grid"
        />
      ) : (
        <ShopCatalogueState
          variant="error"
          title="New editions are unavailable right now"
          description="We could not load the newest editions. Try again, or browse the catalogue."
          browseHref="/artworks"
          browseLabel="Browse editions"
        />
      )}
    </ShopSection>
  );
}

/** One story about how an edition was made; shown only when there is a real one to tell. */
export function HomeStorySection({ story }: { story: HomeStoryVm | null }) {
  if (!story) return null;
  return (
    <section className="shop-home-story" aria-labelledby="home-story-heading">
      <div className="shop-home-story__image">
        <ShopMediaImage
          src={story.imageUrl}
          alt=""
          label={SHOP_MEDIA_LABELS.artwork}
          sizes="(min-width: 64rem) 55vw, 100vw"
          className="absolute inset-0 size-full"
          imgClassName="object-cover"
        />
      </div>
      <div className="shop-home-story__body">
        <p className="shop-home-eyebrow">{SHOP_HOME_CONTENT.story.eyebrow}</p>
        <h2 id="home-story-heading" className="shop-home-story__title">
          {story.title}
        </h2>
        <p className="shop-home-story__text">{story.body}</p>
        <div className="shop-home-story__actions">
          {story.edition ? (
            <ShopCommerceButton href={story.edition.href} variant="outline" scale="standard">
              {`Shop ${story.edition.title}`}
            </ShopCommerceButton>
          ) : null}
          {story.readMoreHref ? (
            <a href={story.readMoreHref} className="shop-home-more shop-focus-ring">
              Read the story on lax.art
              <MarketingArrowUpRightIcon className="shop-home-more__icon" />
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function HomeArtistsSection({ artists }: { artists: HomeArtistsVm | null }) {
  if (!artists) return null;
  const copy = SHOP_HOME_CONTENT.artists;
  return (
    <ShopSection
      id="home-artists"
      title={copy.title}
      viewAll={{ href: "/artists", label: "All artists", srLabel: "with editions" }}
      subtitle={
        <>
          {copy.subtitle}{" "}
          {artists.laxArtHref ? (
            <a href={artists.laxArtHref} className="shop-inline-link shop-focus-ring">
              {copy.laxArtLabel}
            </a>
          ) : null}
        </>
      }
    >
      <MarketingArtistGrid aria-label={copy.title} className="lg:grid-cols-4">
        {artists.cards.map((card) => (
          <MarketingArtistCard
            key={card.id}
            href={card.href}
            name={card.name}
            nameAs="h3"
            facts={card.discipline}
            caption={card.editionsLabel}
            {...(card.image
              ? {
                  portrait: (
                    <ShopMediaImage
                      src={card.image}
                      alt=""
                      label={SHOP_MEDIA_LABELS.artistPortrait}
                      aspect={[4, 5]}
                      sizes="(min-width: 96rem) 20vw, (min-width: 64rem) 25vw, (min-width: 48rem) 30vw, 50vw"
                      className="absolute inset-0 size-full object-cover"
                    />
                  ),
                }
              : {})}
          />
        ))}
      </MarketingArtistGrid>
    </ShopSection>
  );
}

function CollectionTile({ tile }: { tile: HomeCollectionVm }) {
  return (
    <li className="shop-collection">
      <div className="shop-collection__mat" aria-hidden="true">
        {tile.covers.map((cover) => (
          <span key={cover.slug} className="shop-collection__print">
            <ShopMediaImage
              src={cover.imageUrl}
              alt=""
              label={SHOP_MEDIA_LABELS.artwork}
              sizes="(min-width: 64rem) 14vw, 40vw"
              className="absolute inset-0 size-full"
              imgClassName="object-contain"
            />
          </span>
        ))}
      </div>
      <h3 className="shop-collection__title">
        <Link href={tile.href} className="shop-collection__link">
          {tile.title}
        </Link>
      </h3>
      <p className="shop-collection__count">{tile.countLabel}</p>
    </li>
  );
}

export function HomeCollectionsSection({
  collections,
}: { collections: readonly HomeCollectionVm[] }) {
  if (collections.length === 0) return null;
  const copy = SHOP_HOME_CONTENT.collections;
  return (
    <ShopSection id="home-collections" title={copy.title} subtitle={copy.subtitle}>
      <ul className="shop-collections" data-count={collections.length}>
        {collections.map((tile) => (
          <CollectionTile key={tile.key} tile={tile} />
        ))}
      </ul>
    </ShopSection>
  );
}
