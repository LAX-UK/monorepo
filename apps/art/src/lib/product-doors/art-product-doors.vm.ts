import type { ArtEditorialPlacement } from "@/lib/editorial/art-editorial.types";
import type { LaxProductId, LaxProductLinkVm } from "@auction/lax-ecosystem";
import type { MarketingProductDoorVm } from "@auction/marketing-ui";

type ArtDoorProduct = Exclude<LaxProductId, "art">;

type ArtDoorCopy = {
  product: ArtDoorProduct;
  title: string;
  promise: string;
  actionLabel: string;
  /** The CMS placement that may override this door's title, promise and image. */
  promoSlot: ArtEditorialPlacement["slot"];
};

/** The "Across LAX" section that closes the home page and Art Hub. */
export const ART_PRODUCT_DOORS_SECTION = {
  title: "Across LAX",
  description: "Limited editions and live auctions from the gallery’s family.",
} as const;

/**
 * lax.art's doors, in order: Shop first (editions by the same artists), then Bid. Shop is never
 * described as selling originals; those stay on lax.art.
 */
const ART_PRODUCT_DOORS: readonly ArtDoorCopy[] = [
  {
    product: "shop",
    title: "Limited editions from our artists",
    promise: "Editions and prints by the artists we represent, bought online and delivered.",
    actionLabel: "Visit LAX Shop",
    promoSlot: "home_promo_shop",
  },
  {
    product: "bid",
    title: "Art and collectibles at auction",
    promise: "Live and timed sales you can follow and bid in from anywhere.",
    actionLabel: "Visit LAX Bid",
    promoSlot: "home_promo_bid",
  },
];

function filled(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

/**
 * Each door links to its product's storefront for this environment; a product without a link is
 * left out. A CMS promo placement overrides the title, promise and image field by field. Its own
 * `linkUrl` and button label are ignored, so the link stays correct and the action reads the same
 * on every door.
 */
export function buildArtProductDoors(
  links: readonly LaxProductLinkVm[],
  placements: readonly ArtEditorialPlacement[] = [],
): MarketingProductDoorVm[] {
  return ART_PRODUCT_DOORS.flatMap(({ product, promoSlot, ...copy }) => {
    const link = links.find((candidate) => candidate.id === product);
    if (!link) return [];
    const promo = placements
      .filter((placement) => placement.slot === promoSlot)
      .sort((a, b) => a.position - b.position)[0];
    return [
      {
        product,
        title: filled(promo?.headline) ?? copy.title,
        promise: filled(promo?.body) ?? copy.promise,
        actionLabel: copy.actionLabel,
        href: link.href,
        imageUrl: filled(promo?.mediaUrl),
      },
    ];
  });
}
