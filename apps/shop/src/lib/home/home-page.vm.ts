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

/** The grid shows whole desktop rows of four: eight, four, or none. */
const HOME_GRID_ROW = 4;
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
  const artists =
    artistCount === null || artistCount === 0
      ? "LAX artists"
      : artistCount === 1
        ? "one LAX artist"
        : `${artistCount} LAX artists`;
  return `Limited-edition prints by ${artists}. Prices include VAT.`;
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
  const rest = others.length >= HOME_GRID_ROW ? others : input.editions;
  const fullRows = Math.floor(Math.min(rest.length, HOME_GRID_ITEMS) / HOME_GRID_ROW);
  const editions = rest.slice(0, fullRows * HOME_GRID_ROW);

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
    editions,
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
