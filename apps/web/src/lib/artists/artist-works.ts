import { lotWasSold } from "@/lib/lot/lot-outcome";
import type { Lot } from "@auction/types";

export type ArtistWorksTab = "on-sale" | "results";

export type ArtistWorks = {
  /** Lots open for bidding or scheduled to open. */
  onSale: Lot[];
  /** Lots that ended with a buyer: the artist's sold results. */
  results: Lot[];
};

/** Splits an artist's public lots into what is on sale and what has sold. */
export function splitArtistWorks(lots: readonly Lot[]): ArtistWorks {
  const onSale: Lot[] = [];
  const results: Lot[] = [];
  for (const lot of lots) {
    if (lot.status === "active" || lot.status === "scheduled") onSale.push(lot);
    else if (lot.status === "ended" && lotWasSold(lot)) results.push(lot);
  }
  return { onSale, results };
}

/** The tab named by `?tab=`; anything else is "On sale", the default view. */
export function parseArtistWorksTab(value: string | string[] | undefined): ArtistWorksTab {
  return (Array.isArray(value) ? value[0] : value) === "results" ? "results" : "on-sale";
}

export type ArtistWorksTabItem = {
  id: ArtistWorksTab;
  label: string;
  href: string;
  /** Left out at zero, so an empty tab carries no "0". */
  count?: number;
};

/** The two tabs, each a real address on the artist page (`#works` keeps the reader in place). */
export function artistWorksTabItems(input: {
  profilePath: string;
  works: ArtistWorks;
}): ArtistWorksTabItem[] {
  const { profilePath, works } = input;
  const item = (
    id: ArtistWorksTab,
    label: string,
    href: string,
    total: number,
  ): ArtistWorksTabItem => ({ id, label, href, ...(total > 0 ? { count: total } : {}) });
  return [
    item("on-sale", "On sale", `${profilePath}#works`, works.onSale.length),
    item("results", "Past results", `${profilePath}?tab=results#works`, works.results.length),
  ];
}
