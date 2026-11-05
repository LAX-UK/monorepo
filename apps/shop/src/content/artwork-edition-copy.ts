/**
 * The labels and fixed lines of the edition page. What is said about an edition itself (its run,
 * signature, number, certificate and proofs) is written by `describeEditionFacts` in shop-domain
 * and never here; these are only the names of the sections and rows around it.
 */
export const EDITION_PAGE_COPY = {
  vatNote: "Includes VAT",
  addToBasket: "Add to basket",
  soldOut: "Sold out",
  soldOutAction: "Get an email if it comes back",
  inBasket: "In your basket",
  viewBasket: "View basket",
  factsTitle: "About this edition",
  factLabels: {
    edition: "Edition",
    signature: "Signature",
    number: "Number",
    certificate: "Certificate",
    proofs: "Proofs",
  },
  alsoAvailableTitle: "Also available",
  originalLink: "See the original at lax.art",
  aboutWorkTitle: "About the work and the print",
  moreAboutEdition: "More about this edition",
  workLabels: { medium: "Medium", paper: "Paper", sheetSize: "Sheet size", framing: "Framing" },
  artistTitle: "About the artist",
  profileOnLaxArt: "Profile on lax.art",
} as const;

export function editionsByLabel(artistName: string, count: number): string {
  return `Editions by ${artistName} (${count})`;
}

export function moreByTitle(artistName: string): string {
  return `More by ${artistName}`;
}

export function oneMoreEditionLabel(artistName: string): string {
  return `1 more edition by ${artistName}`;
}

export function allEditionsLabel(artistName: string, count: number): string {
  return `All ${count} editions by ${artistName}`;
}
