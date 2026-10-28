import {
  type PlacementSlot,
  type PlannedPlacement,
  maxItemsForPlacement,
} from "./placement-slot.js";
import type { ShopStaffCapability } from "./staff-capabilities.js";

/**
 * The home lists staff curate in LAX Admin's Featured on home: the prints the Shop home release
 * is chosen from, the artists featured on the Shop and lax.art homes, and the order of the Shop's
 * categories. Originals are not curated here.
 */
export const HOME_FEATURE_SLOTS = [
  "featured_prints",
  "featured_artists",
  "featured_categories",
] as const satisfies readonly PlacementSlot[];

export type HomeFeatureSlot = (typeof HOME_FEATURE_SLOTS)[number];

export function isHomeFeatureSlot(value: string): value is HomeFeatureSlot {
  return (HOME_FEATURE_SLOTS as readonly string[]).includes(value);
}

/**
 * Saving a list changes the public home pages at once, so it needs the capability that publishes
 * editorial content. Reading the lists needs none: they show what is already public.
 */
export const HOME_FEATURES_EDIT_CAPABILITY: ShopStaffCapability = "editorial.publish";

/** How many staff-placed prints the Shop home reads when it chooses its release. */
export const HOME_RELEASE_CANDIDATE_LIMIT = 4;

/** What a slot's save needs to know about each chosen record. */
export type HomeFeatureTargetFacts =
  | { kind: "artwork"; id: string; isShopEdition: boolean }
  | { kind: "artist"; id: string }
  | { kind: "category"; id: string };

export type HomeFeatureIssueReason = "unknown" | "duplicate" | "not_a_shop_edition" | "over_limit";

/** Why one chosen record cannot be saved where it is. `index` is its place in the list. */
export type HomeFeatureIssue = { index: number; targetId: string; reason: HomeFeatureIssueReason };

const SLOT_TARGET: Record<HomeFeatureSlot, HomeFeatureTargetFacts["kind"]> = {
  featured_prints: "artwork",
  featured_artists: "artist",
  featured_categories: "category",
};

/** The records a slot can hold, at most. */
export function homeFeatureLimit(slot: HomeFeatureSlot): number {
  return maxItemsForPlacement(slot);
}

/**
 * The problems with a list as ordered, before anything is looked up: a record chosen twice, and
 * every record past the slot's limit. LAX Admin runs this as staff edit, shop-api again on save.
 */
export function homeFeatureListIssues(
  slot: HomeFeatureSlot,
  targetIds: readonly string[],
): HomeFeatureIssue[] {
  const limit = homeFeatureLimit(slot);
  const seen = new Set<string>();
  const issues: HomeFeatureIssue[] = [];
  targetIds.forEach((targetId, index) => {
    if (seen.has(targetId)) {
      issues.push({ index, targetId, reason: "duplicate" });
    } else if (index >= limit) {
      issues.push({ index, targetId, reason: "over_limit" });
    }
    seen.add(targetId);
  });
  return issues;
}

function targetIssue(
  slot: HomeFeatureSlot,
  facts: HomeFeatureTargetFacts | undefined,
): HomeFeatureIssueReason | null {
  if (!facts || facts.kind !== SLOT_TARGET[slot]) return "unknown";
  if (facts.kind === "artwork" && !facts.isShopEdition) return "not_a_shop_edition";
  return null;
}

export type HomeFeaturePlan =
  | { ok: true; placements: PlannedPlacement[] }
  | { ok: false; issues: HomeFeatureIssue[] };

/**
 * Turns a slot's ordered list into its placements, or says what is wrong with it: a record that
 * does not exist (or is not the slot's kind), a print that is not a Shop edition, a record chosen
 * twice, or more records than the slot holds.
 */
export function planHomeFeatures(
  slot: HomeFeatureSlot,
  targetIds: readonly string[],
  factsById: ReadonlyMap<string, HomeFeatureTargetFacts>,
): HomeFeaturePlan {
  const listIssues = homeFeatureListIssues(slot, targetIds);
  const flagged = new Set(listIssues.map((issue) => issue.index));
  const issues = [...listIssues];
  targetIds.forEach((targetId, index) => {
    if (flagged.has(index)) return;
    const reason = targetIssue(slot, factsById.get(targetId));
    if (reason) issues.push({ index, targetId, reason });
  });
  if (issues.length > 0) {
    return { ok: false, issues: issues.sort((a, b) => a.index - b.index) };
  }
  return {
    ok: true,
    placements: targetIds.map((id, position) => ({
      slot,
      position,
      target: { kind: SLOT_TARGET[slot], id },
    })),
  };
}

/** What decides whether a placed print can be the Shop home release. */
export type FeaturedPrintFacts = {
  /** Published, not archived, and listed on the Shop. */
  live: boolean;
  soldOut: boolean;
  hasImage: boolean;
};

export type FeaturedPrintRole =
  /** The release on the Shop home's first screen. */
  | "home_release"
  /** Ready to lead, and used if the prints above it can no longer. */
  | "next_in_line"
  | "sold_out"
  | "no_image"
  /** A draft or withdrawn work: the Shop does not show it at all. */
  | "not_live"
  /** Ready, but below the prints the home reads. */
  | "beyond_candidates";

/**
 * What the Shop home does with each placed print, in order. The home reads the first
 * `HOME_RELEASE_CANDIDATE_LIMIT` live prints and leads with the first one that is on sale and has
 * an image; sold-out works and works without an image are skipped.
 */
export function featuredPrintRoles(items: readonly FeaturedPrintFacts[]): FeaturedPrintRole[] {
  let liveSeen = 0;
  let releaseChosen = false;
  return items.map((item) => {
    if (!item.live) return "not_live";
    liveSeen += 1;
    if (liveSeen > HOME_RELEASE_CANDIDATE_LIMIT) return "beyond_candidates";
    if (item.soldOut) return "sold_out";
    if (!item.hasImage) return "no_image";
    if (releaseChosen) return "next_in_line";
    releaseChosen = true;
    return "home_release";
  });
}

/** Where a featured artist can appear: lax.art shows their originals, the Shop their editions. */
export type FeaturedArtistFacts = {
  /** Not archived, with at least one original on lax.art. */
  onArt: boolean;
  /** Not archived, with at least one Shop edition on sale. */
  hasEditionsOnSale: boolean;
};

export type FeaturedArtistPresence = "on_art" | "on_shop" | "not_on_shop";

/** The homes a featured artist appears on, lax.art first; says so when the Shop leaves them out. */
export function featuredArtistPresence(facts: FeaturedArtistFacts): FeaturedArtistPresence[] {
  const presence: FeaturedArtistPresence[] = [];
  if (facts.onArt) presence.push("on_art");
  presence.push(facts.hasEditionsOnSale ? "on_shop" : "not_on_shop");
  return presence;
}
