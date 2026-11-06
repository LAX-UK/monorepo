import { ShopArtistCard as ArtistCard } from "@/components/artists/shop-artist-card";
import { ShopSection } from "@/components/layout/shop-section";
import { ShopMediaImage } from "@/components/media/shop-media-image";
import { ShopCommerceButton } from "@/components/shop-commerce-button";
import { SHOP_HOME_CONTENT } from "@/content/home/shop-home-content";
import type { CatalogueArtistCardVm } from "@/lib/catalogue/catalogue-artist-card.vm";
import type { HomeArtistsVm, HomeSoloArtistVm } from "@/lib/home/home-artists";
import {
  MarketingArrowUpRightIcon,
  MarketingArtistFeature,
  MarketingArtistPair,
  MarketingArtistPairRow,
  MarketingArtistPortraitFill,
  MarketingCardRow,
  MarketingHorizontalRail,
  marketingArtistInitials,
} from "@auction/marketing-ui";

const copy = SHOP_HOME_CONTENT.artists;

function ArtistPortrait({ card, sizes }: { card: CatalogueArtistCardVm; sizes: string }) {
  return (
    <MarketingArtistPortraitFill
      name={card.name}
      withoutImage="initials"
      image={
        card.image ? (
          <ShopMediaImage
            src={card.image}
            alt=""
            monogram={marketingArtistInitials(card.name)}
            aspect={[4, 5]}
            sizes={sizes}
            className="absolute inset-0 size-full object-cover"
          />
        ) : card.workImage ? (
          // The lead edition is shown whole on the paper mat, as on the artist card in a row.
          <span className="marketing-work-mat absolute inset-0 block p-[7%]">
            <span className="relative block size-full">
              <ShopMediaImage
                src={card.workImage}
                alt=""
                aspect={[4, 5]}
                sizes={sizes}
                className="absolute inset-0 size-full"
                imgClassName="object-contain"
              />
            </span>
          </span>
        ) : null
      }
    />
  );
}

/** One artist, told at length: the portrait beside their facts, a short bio and both doors. */
function SoloArtist({ solo }: { solo: HomeSoloArtistVm }) {
  return (
    <MarketingArtistFeature
      name={solo.card.name}
      href={solo.card.href}
      portrait={<ArtistPortrait card={solo.card} sizes="(min-width: 48rem) 30vw, 90vw" />}
      eyebrow={<span className="shop-home-eyebrow">{copy.soloEyebrow}</span>}
      facts={solo.factsLine}
      bio={solo.shortBio}
      count={solo.countLabel}
      actions={
        <>
          <ShopCommerceButton href={solo.editionsLink.href} variant="outline" scale="standard">
            {solo.editionsLink.label}
          </ShopCommerceButton>
          {solo.profileHref ? (
            <a href={solo.profileHref} className="shop-home-more shop-focus-ring">
              {copy.profileLabel}
              <MarketingArrowUpRightIcon className="shop-home-more__icon" />
            </a>
          ) : null}
        </>
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
        <MarketingArtistPair aria-label={copy.title}>
          {artists.cards.map((card) => (
            <li key={card.id}>
              <MarketingArtistPairRow
                name={card.name}
                href={card.href}
                portrait={<ArtistPortrait card={card} sizes="10rem" />}
                facts={card.discipline}
                count={card.editionsLabel}
                linkLabel={`Editions by ${card.name}`}
              />
            </li>
          ))}
        </MarketingArtistPair>
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
