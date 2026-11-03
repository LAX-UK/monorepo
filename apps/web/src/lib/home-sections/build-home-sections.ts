import { buildHomeArtists } from "@/lib/home-sections/artists";
import { buildComingUp } from "@/lib/home-sections/coming-up";
import { buildDepartments } from "@/lib/home-sections/departments";
import type { ArtistNames } from "@/lib/home-sections/lot-card";
import { soldOrder } from "@/lib/home-sections/lot-order";
import { type LotRailKind, buildLotRail } from "@/lib/home-sections/lot-rail";
import { buildPress } from "@/lib/home-sections/press";
import { buildResultsBand } from "@/lib/home-sections/results-band";
import { buildSelling } from "@/lib/home-sections/selling";
import type { HomeSections } from "@/lib/home-sections/types";
import type { SaleListRow } from "@/lib/sale-list-row";
import { type HomeSectionId, type HomeStateResult, pruneEmptyHomeSections } from "@auction/domain";
import type { Category, Lot, PressArchiveEntry, PublicArtistDirectoryRow } from "@auction/types";

export type HomeSectionsSource = {
  state: HomeStateResult;
  now: Date;
  /** Every sale read for the page: live, scheduled and ended. */
  rows: readonly SaleListRow[];
  /** Lots read for each sale the page draws from. */
  lotsBySale: ReadonlyMap<string, readonly Lot[]>;
  /** The lots the lot-bearing sections were given, after each lot was placed once. */
  placed: { rail: readonly Lot[]; results: readonly Lot[] };
  artistNames: ArtistNames;
  categories: readonly Category[];
  artists: readonly PublicArtistDirectoryRow[];
  press: readonly PressArchiveEntry[];
};

type Builder<K extends HomeSectionId> = (source: HomeSectionsSource) => HomeSections[K] | null;

const rowOf = (source: HomeSectionsSource, id: string | null | undefined) =>
  id ? source.rows.find((row) => row.sale.id === id) : undefined;

function railBuilder<K extends LotRailKind>(kind: K): Builder<K> {
  return (source) => {
    const row = rowOf(source, source.state.leadSaleId);
    if (!row) return null;
    return buildLotRail({
      kind,
      sale: row.sale,
      lots: source.placed.rail,
      lotCount: row.lotCount,
      artistNames: source.artistNames,
      now: source.now,
    });
  };
}

const resultsBand: Builder<"recentResults"> = (source) => {
  const row = rowOf(source, source.state.resultsBandSaleIds[0]);
  return buildResultsBand({
    row,
    lots: source.placed.results,
    saleLots: row ? (source.lotsBySale.get(row.sale.id) ?? []) : [],
    artistNames: source.artistNames,
    subtitle:
      source.state.state === "betweenSeasons"
        ? "The last twelve months at LAX Bid"
        : "Prices include buyer’s premium",
    now: source.now,
  });
};

const selling: Builder<"selling"> = (source) => {
  const bandId = source.state.resultsBandSaleIds[0];
  const soldWorks = soldOrder(bandId ? (source.lotsBySale.get(bandId) ?? []) : []);
  return buildSelling({
    scheduledSales: source.rows
      .map((row) => row.sale)
      .filter((sale) => sale.status === "scheduled"),
    imageUrls: soldWorks.map((lot) => lot.images[0]),
    now: source.now,
  });
};

/** One builder per section: a section is added here, not in an if-chain. */
const BUILDERS: { [K in HomeSectionId]: Builder<K> } = {
  inThisSale: railBuilder("inThisSale"),
  highlightsFromNextSale: railBuilder("highlightsFromNextSale"),
  topLotsOfSale: railBuilder("topLotsOfSale"),
  comingUp: (source) => buildComingUp(source.rows, source.state.comingUpSaleIds, source.now),
  recentResults: resultsBand,
  departments: (source) =>
    buildDepartments(source.categories, [...source.lotsBySale.values()].flat()),
  artists: (source) => buildHomeArtists(source.artists),
  selling,
  alerts: () => true,
  fromLaxAndPress: (source) => buildPress(source.press),
};

/**
 * The sections of the home state with something to show, keyed by section. A section with
 * nothing to show is absent, never emptied.
 */
export function buildHomeSections(source: HomeSectionsSource): HomeSections {
  const sections: Record<string, unknown> = {};
  for (const id of source.state.sections) {
    const section = (BUILDERS[id] as Builder<HomeSectionId>)(source);
    if (section) sections[id] = section;
  }
  return sections as HomeSections;
}

/** The ids to render, in the state's order, once the empty ones are dropped. */
export function visibleHomeSections(
  state: Pick<HomeStateResult, "sections">,
  sections: HomeSections,
): HomeSectionId[] {
  return pruneEmptyHomeSections(state.sections, (id) => sections[id] !== undefined);
}
