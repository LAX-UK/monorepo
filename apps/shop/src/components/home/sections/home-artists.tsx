import { ShopArtistPortrait } from "@/components/artists/shop-artist-portrait";
import { ShopSection } from "@/components/layout/shop-section";
import { ShopMediaImage } from "@/components/media/shop-media-image";
import { ShopCommerceButton } from "@/components/shop-commerce-button";
import { SHOP_HOME_CONTENT } from "@/content/home/shop-home-content";
import type { CatalogueArtistCardVm } from "@/lib/catalogue/catalogue-artist-card.vm";
import type { HomeArtistsVm, HomeSoloArtistVm } from "@/lib/home/home-artists";
import { SHOP_MEDIA_LABELS } from "@/lib/media/shop-media-labels";
import {
  MarketingArrowUpRightIcon,
  MarketingArtistCard,
  MarketingCardRow,
  MarketingHorizontalRail,
  MarketingSplitFeature,
} from "@auction/marketing-ui";
import Link from "next/link";

const copy = SHOP_HOME_CONTENT.artists;

const CARD_SIZES = "(min-width: 64rem) 22vw, (min-width: 40rem) 30vw, 45vw";

/** The shared artist card: portrait, name, discipline and "4 editions", to their editions. */
function ArtistCard({ card }: { card: CatalogueArtistCardVm }) {
  return (
    <MarketingArtistCard
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
                sizes={CARD_SIZES}
                className="absolute inset-0 size-full object-cover"
              />
            ),
          }
        : {})}
    />
  );
}

/** Two artists side by side: each a portrait beside the name, discipline, count and link. */
function ArtistPairRow({ card }: { card: CatalogueArtistCardVm }) {
  return (
    <article className="shop-home-artist-pair">
      <Link
        href={card.href}
        tabIndex={-1}
        aria-hidden="true"
        className="shop-home-artist-pair__portrait"
      >
        <ShopArtistPortrait name={card.name} src={card.image} sizes="10rem" />
      </Link>
      <div className="shop-home-artist-pair__body">
        <h3 className="shop-home-artist-pair__name">{card.name}</h3>
        {card.discipline ? <p className="shop-home-artist-pair__facts">{card.discipline}</p> : null}
        {card.editionsLabel ? (
          <p className="shop-home-artist-pair__count">{card.editionsLabel}</p>
        ) : null}
        <Link
          href={card.href}
          className="shop-inline-link shop-focus-ring shop-home-artist-pair__link"
        >
          {`Editions by ${card.name}`}
        </Link>
      </div>
    </article>
  );
}

/** One artist, told at length: the portrait beside their facts, a short bio and both doors. */
function SoloArtist({ solo }: { solo: HomeSoloArtistVm }) {
  return (
    <MarketingSplitFeature
      className="shop-home-feature shop-home-feature--portrait"
      tone="plain"
      mediaSide="left"
      eyebrow={<span className="shop-home-eyebrow">{copy.soloEyebrow}</span>}
      title={solo.card.name}
      media={
        <Link
          href={solo.card.href}
          tabIndex={-1}
          aria-hidden="true"
          className="shop-home-feature__media"
        >
          <ShopArtistPortrait
            name={solo.card.name}
            src={solo.card.image}
            sizes="(min-width: 48rem) 30vw, 90vw"
            className="shop-home-feature__mat"
          />
        </Link>
      }
      body={
        <div className="shop-home-feature__caption">
          {solo.factsLine ? <p>{solo.factsLine}</p> : null}
          {solo.shortBio ? <p className="shop-home-feature__bio">{solo.shortBio}</p> : null}
          {solo.countLabel ? <p className="shop-home-feature__count">{solo.countLabel}</p> : null}
        </div>
      }
      action={
        <div className="shop-home-feature__actions">
          <ShopCommerceButton href={solo.editionsLink.href} variant="outline" scale="standard">
            {solo.editionsLink.label}
          </ShopCommerceButton>
          {solo.profileHref ? (
            <a href={solo.profileHref} className="shop-home-more shop-focus-ring">
              {copy.profileLabel}
              <MarketingArrowUpRightIcon className="shop-home-more__icon" />
            </a>
          ) : null}
        </div>
      }
    />
  );
}

function ArtistsBody({ artists }: { artists: HomeArtistsVm }) {
  switch (artists.layout) {
    case "feature":
      return null;
    case "pair":
      return (
        <ul className="shop-home-artist-pairs" aria-label={copy.title}>
          {artists.cards.map((card) => (
            <li key={card.id}>
              <ArtistPairRow card={card} />
            </li>
          ))}
        </ul>
      );
    case "row":
      return (
        <MarketingCardRow
          aria-label={copy.title}
          items={artists.cards}
          getKey={(card) => card.id}
          max={artists.cards.length}
          renderItem={(card) => <ArtistCard card={card} />}
        />
      );
    case "rail":
      return (
        <MarketingHorizontalRail
          id="home-artists-rail"
          ariaLabel={copy.title}
          forwardAriaLabel="Scroll artists forward"
          backAriaLabel="Scroll artists back"
          controls="arrows-progress"
          scrollerAs="ul"
          scrollerClassName="shop-home-artist-rail shop-focus-ring"
        >
          {artists.cards.map((card) => (
            <li key={card.id} className="shop-home-artist-rail__item">
              <ArtistCard card={card} />
            </li>
          ))}
        </MarketingHorizontalRail>
      );
  }
}

/**
 * The artists with editions on sale, on the shared artist card and laid out for their count: one
 * artist is a feature, two a pair, three or four a row, five to eight a rail. Each leads to the
 * artist's editions in the Shop; their full stories are on lax.art.
 */
export function HomeArtistsSection({ artists }: { artists: HomeArtistsVm | null }) {
  if (!artists) return null;
  if (artists.layout === "feature" && artists.solo) return <SoloArtist solo={artists.solo} />;
  return (
    <ShopSection
      id="home-artists"
      title={copy.title}
      {...(artists.viewAll ? { viewAll: { ...artists.viewAll, srLabel: "with editions" } } : {})}
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
      <ArtistsBody artists={artists} />
    </ShopSection>
  );
}
