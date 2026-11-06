import { isCatalogueArtworkSoldOut } from "@/lib/catalogue/catalogue-artwork-card.vm";
import type { PublicArtworkSummary } from "@auction/shop-contracts";

/**
 * Every version of one work (a main run and its proof or companion listings) as one entry.
 * The lead is the version the card speaks for: the cheapest one that can be bought, or, when
 * none can, the cheapest of all.
 */
export type EditionWorkGroup = {
  /** The slug every version hangs from. */
  workSlug: string;
  lead: PublicArtworkSummary;
  versions: readonly PublicArtworkSummary[];
  /** True only when every version is sold out. */
  soldOut: boolean;
  /** The cheapest price among the versions that can be bought; null when none is priced. */
  fromPricePence: number | null;
};

function groupKey(item: PublicArtworkSummary): string {
  return `${item.artistSlug}::${item.workSlug ?? item.slug}`;
}

function cheapest(items: readonly PublicArtworkSummary[]): PublicArtworkSummary | null {
  let best: PublicArtworkSummary | null = null;
  for (const item of items) {
    if (item.printPricePence === null) continue;
    if (
      best === null ||
      item.printPricePence < (best.printPricePence ?? Number.POSITIVE_INFINITY)
    ) {
      best = item;
    }
  }
  return best;
}

function toGroup(versions: readonly PublicArtworkSummary[]): EditionWorkGroup {
  const buyable = versions.filter((item) => !isCatalogueArtworkSoldOut(item));
  const lead = cheapest(buyable) ?? buyable[0] ?? cheapest(versions) ?? (versions[0] as never);
  return {
    workSlug: lead.workSlug ?? lead.slug,
    lead,
    versions,
    soldOut: buyable.length === 0,
    fromPricePence: cheapest(buyable)?.printPricePence ?? null,
  };
}

/**
 * One group per work, in the order each work first appears. Versions of one work share the
 * artist and the `workSlug` the catalogue gives them; an older shop-api sends none, so each
 * edition then stands alone.
 */
export function groupEditionVersions(items: readonly PublicArtworkSummary[]): EditionWorkGroup[] {
  const byKey = new Map<string, PublicArtworkSummary[]>();
  for (const item of items) {
    const key = groupKey(item);
    const members = byKey.get(key);
    if (members) members.push(item);
    else byKey.set(key, [item]);
  }
  return [...byKey.values()].map(toGroup);
}

/**
 * Where the card leads: the work's own page when it is among the versions (its page lets the
 * buyer pick a version), otherwise the lead version's page.
 */
export function editionGroupSlug(group: EditionWorkGroup): string {
  if (group.versions.length > 1 && group.versions.some((v) => v.slug === group.workSlug)) {
    return group.workSlug;
  }
  return group.lead.slug;
}
