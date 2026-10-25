import {
  type CatalogueArtistCardVm,
  buildCatalogueArtistCards,
} from "@/lib/catalogue/catalogue-artist-card.vm";
import {
  type CatalogueArtworkCardVm,
  toCatalogueArtworkCardVm,
} from "@/lib/catalogue/catalogue-artwork-card.vm";
import { SHOP_RETURNS_LINE, shopDeliveryLine } from "@/lib/presenters/artwork-purchase.presenter";
import type { PublicArtworkSummary } from "@auction/shop-contracts";
import type { HomePageComposerResult, HomeSectionKey } from "./home-page.composer";

/** A home section with fewer works than this is left out rather than shown half empty. */
export const HOME_MIN_SECTION_ITEMS = 3;
const HOME_GRID_ITEMS = 8;

export type HomeHeroVm = {
  title: string;
  lead: string;
  primary: { label: string; href: string };
  secondary: { label: string; href: string };
  deliveryLine: string;
  returnsLine: string;
  /** A real edition on sale now, shown whole beside the copy; null when none has an image. */
  feature: CatalogueArtworkCardVm | null;
};

export type HomeEditionStepVm = {
  id: "size" | "number" | "certificate" | "delivery";
  title: string;
  body: string;
};

export type HomePageViewModel = {
  hero: HomeHeroVm;
  editions: PublicArtworkSummary[];
  artists: CatalogueArtistCardVm[];
  steps: HomeEditionStepVm[];
  sectionErrors: Partial<Record<HomeSectionKey, string>>;
};

function heroLead(artistCount: number | null): string {
  if (artistCount === null || artistCount === 0) {
    return "Prints from limited editions, each with its edition size stated. Prices include VAT.";
  }
  const artists = artistCount === 1 ? "one artist" : `${artistCount} artists`;
  return `Prints by ${artists}, each from a limited edition with its size stated. Prices include VAT.`;
}

/**
 * The home page leads with what Shop sells: a first screen naming editions with one real work,
 * then editions on sale now, the artists behind them, and how buying an edition works.
 */
export function buildHomePageViewModel(input: HomePageComposerResult): HomePageViewModel {
  const featureItem = input.editions.find((item) => item.imageUrl !== null) ?? null;
  // The grid skips the work already in the first screen, unless that would leave it too short.
  const others = featureItem
    ? input.editions.filter((item) => item.slug !== featureItem.slug)
    : input.editions;
  const rest = others.length >= HOME_MIN_SECTION_ITEMS ? others : input.editions;
  const editions = rest.slice(0, HOME_GRID_ITEMS);

  return {
    hero: {
      title: "Limited editions and prints",
      lead: heroLead(input.artistCount),
      primary: { label: "Browse editions", href: "/artworks" },
      secondary: { label: "See the artists", href: "/artists" },
      deliveryLine: shopDeliveryLine(),
      returnsLine: SHOP_RETURNS_LINE,
      feature: featureItem ? toCatalogueArtworkCardVm(featureItem) : null,
    },
    editions: editions.length >= HOME_MIN_SECTION_ITEMS ? editions : [],
    artists: buildCatalogueArtistCards(input.artists.filter((artist) => artist.artworkCount > 0)),
    steps: [
      {
        id: "size",
        title: "A stated edition size",
        body: "Every work shows the size of its edition, so you know how many prints there are.",
      },
      {
        id: "number",
        title: "Your edition number",
        body: "Each print is given its number in the edition when your order is fulfilled.",
      },
      {
        id: "certificate",
        title: "Certificates where stated",
        body: "When a work comes with a certificate of authenticity, its details say so.",
      },
      {
        id: "delivery",
        title: "Delivery and returns",
        body: `${shopDeliveryLine()}. You can cancel within 14 days.`,
      },
    ],
    sectionErrors: input.sectionErrors,
  };
}
