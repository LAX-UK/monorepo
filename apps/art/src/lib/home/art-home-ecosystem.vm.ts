import type { ArtEditorialPlacement } from "@/lib/editorial/art-editorial.types";
import type { LaxProductLinkVm } from "@auction/lax-ecosystem";

type BandProductId = "bid" | "shop";

export type ArtHomeEcosystemCardVm = {
  id: BandProductId;
  eyebrow: string;
  title: string;
  body: string;
  cta: { label: string; href: string };
  imageUrl: string | null;
};

const PROMO_SLOTS: Record<BandProductId, ArtEditorialPlacement["slot"]> = {
  bid: "home_promo_bid",
  shop: "home_promo_shop",
};

function filled(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

type EcosystemCopy = Omit<ArtHomeEcosystemCardVm, "id" | "cta" | "imageUrl"> & { ctaLabel: string };

/** Product-owned copy for the LAX Bid and LAX Shop band (Figma home `299:4535`), in band order. */
const ECOSYSTEM_COPY: ReadonlyArray<[BandProductId, EcosystemCopy]> = [
  [
    "bid",
    {
      eyebrow: "LAX Bid",
      title: "Bid in auctions",
      body: "LAX Bid is the dedicated auction destination within the wider LAX ecosystem. Exceptional works, considered curation, open to all.",
      ctaLabel: "Explore auctions",
    },
  ],
  [
    "shop",
    {
      eyebrow: "LAX Shop",
      title: "Collect with certainty",
      body: "LAX Shop is the dedicated editions destination: a considered selection of limited editions and prints.",
      ctaLabel: "Explore editions",
    },
  ],
];

/**
 * Each card links to its product's resolved storefront; a product without a link is left out.
 * A CMS promo placement overrides the copy and image field by field. Its own `linkUrl` is ignored
 * so the cross-product link stays correct for the environment.
 */
export function buildArtHomeEcosystemCards(
  links: readonly LaxProductLinkVm[],
  placements: readonly ArtEditorialPlacement[] = [],
): ArtHomeEcosystemCardVm[] {
  return ECOSYSTEM_COPY.flatMap(([id, { ctaLabel, ...copy }]) => {
    const link = links.find((candidate) => candidate.id === id);
    if (!link) return [];
    const promo = placements
      .filter((placement) => placement.slot === PROMO_SLOTS[id])
      .sort((a, b) => a.position - b.position)[0];
    return [
      {
        id,
        eyebrow: copy.eyebrow,
        title: filled(promo?.headline) ?? copy.title,
        body: filled(promo?.body) ?? copy.body,
        cta: { label: filled(promo?.ctaLabel) ?? ctaLabel, href: link.href },
        imageUrl: filled(promo?.mediaUrl),
      },
    ];
  });
}
