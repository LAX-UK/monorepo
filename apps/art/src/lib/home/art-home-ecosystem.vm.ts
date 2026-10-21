import type { LaxProductLinkVm } from "@auction/lax-ecosystem";

type BandProductId = "bid" | "shop";

export type ArtHomeEcosystemCardVm = {
  id: BandProductId;
  eyebrow: string;
  title: string;
  body: string;
  cta: { label: string; href: string };
};

type EcosystemCopy = Omit<ArtHomeEcosystemCardVm, "id" | "cta"> & { ctaLabel: string };

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
      body: "LAX Shop is the dedicated editions destination: a considered selection of artist originals and prints.",
      ctaLabel: "Explore editions",
    },
  ],
];

/** Each card links to its product's resolved storefront; a product without a link is left out. */
export function buildArtHomeEcosystemCards(
  links: readonly LaxProductLinkVm[],
): ArtHomeEcosystemCardVm[] {
  return ECOSYSTEM_COPY.flatMap(([id, { ctaLabel, ...copy }]) => {
    const link = links.find((candidate) => candidate.id === id);
    return link ? [{ id, ...copy, cta: { label: ctaLabel, href: link.href } }] : [];
  });
}
