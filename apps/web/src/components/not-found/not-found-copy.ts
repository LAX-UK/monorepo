import type { LaxIllustrationName } from "@auction/ui/components/lax-illustration";

/** What kind of page was not found. Each kind has its own words; the layout is shared. */
export type NotFoundKind = "page" | "lot" | "sale" | "artist";

export type NotFoundLink = { href: string; label: string };

export type NotFoundCopy = {
  /** The page title, before the product name is added. */
  documentTitle: string;
  title: string;
  description: string;
  /** The drawing on the paper plate; a lot shows the hatched placeholder instead. */
  illustration: LaxIllustrationName;
  /** Shows a search field: only when the visitor's intent is unknown. */
  search: boolean;
  /** The first link is the primary action. */
  links: readonly NotFoundLink[];
};

/** The copy for each kind of not found, in one table so a new kind is a new row. */
export const NOT_FOUND_COPY: Readonly<Record<NotFoundKind, NotFoundCopy>> = {
  page: {
    documentTitle: "Page not found",
    title: "We can't find that page",
    description: "The link may be mistyped, or the page may have moved.",
    illustration: "ticket",
    search: true,
    links: [
      { href: "/sales", label: "Current auctions" },
      { href: "/buy", label: "How to buy" },
      { href: "/contact", label: "Contact us" },
    ],
  },
  lot: {
    documentTitle: "Lot not found",
    title: "We can't find that lot",
    description: "The link may be mistyped, or the lot may have moved to another sale.",
    illustration: "ticket",
    search: false,
    links: [
      { href: "/search", label: "Search lots" },
      { href: "/sales", label: "Current auctions" },
    ],
  },
  sale: {
    documentTitle: "Sale not found",
    title: "We can't find that sale",
    description: "It may have been renamed or moved to results.",
    illustration: "gavel",
    search: false,
    links: [
      { href: "/sales", label: "Current auctions" },
      { href: "/sales?tab=results", label: "Past results" },
    ],
  },
  artist: {
    documentTitle: "Artist not found",
    title: "We can't find that artist",
    description: "Try the artist directory.",
    illustration: "frame",
    search: false,
    links: [{ href: "/artists", label: "Browse artists" }],
  },
};
