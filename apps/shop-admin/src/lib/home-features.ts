import type {
  AdminHomeFeatureArtist,
  AdminHomeFeatureCategory,
  AdminHomeFeatureIssue,
  AdminHomeFeaturePrint,
  AdminHomeFeatureRow,
  AdminHomeFeatureSlot,
} from "@auction/shop-contracts";
import {
  type FeaturedArtistPresence,
  type FeaturedPrintRole,
  HOME_RELEASE_CANDIDATE_LIMIT,
  type HomeFeatureIssueReason,
  featuredArtistPresence,
  featuredPrintRoles,
  homeFeatureLimit,
  homeFeatureListIssues,
} from "@auction/shop-domain";
import type { StaffStatusTone } from "@auction/staff-ui";

/*
 * Featured on home in LAX Admin: what each list is called, what it drives, and each row's
 * status line. The rules come from `@auction/shop-domain`; this file only words them.
 */

export type HomeFeatureStatus = { tone: StaffStatusTone; label: string };

/** A row as the editor shows it, whatever its slot. */
export type HomeFeatureRowView = {
  id: string;
  title: string;
  subtitle: string | null;
  image: { src: string | null; missingLabel: string } | null;
};

type SlotCopy = {
  title: string;
  description: string;
  /** Lower case, for buttons and messages: "print". */
  noun: string;
  plural: string;
  addLabel: string;
  emptyText: string;
};

export const HOME_FEATURE_SLOT_ORDER = [
  "featured_prints",
  "featured_artists",
  "featured_categories",
] as const satisfies readonly AdminHomeFeatureSlot[];

export const HOME_FEATURE_SLOT_COPY: Record<AdminHomeFeatureSlot, SlotCopy> = {
  featured_prints: {
    title: "Featured prints",
    description: `The LAX Shop home leads with the first of these on sale with an image, from the first ${HOME_RELEASE_CANDIDATE_LIMIT}.`,
    noun: "print",
    plural: "prints",
    addLabel: "Add a print",
    emptyText: "No prints chosen. The Shop home leads with its newest edition on sale.",
  },
  featured_artists: {
    title: "Featured artists",
    description:
      "Shown first in the artists on the LAX Shop and lax.art homes, in this order. Each home leaves out an artist it has nothing of.",
    noun: "artist",
    plural: "artists",
    addLabel: "Add an artist",
    emptyText: "No artists chosen. Both homes show the artists with the newest work.",
  },
  featured_categories: {
    title: "Featured categories",
    description: "The order of the categories in Browse by on the LAX Shop home.",
    noun: "category",
    plural: "categories",
    addLabel: "Add a category",
    emptyText: "No categories chosen. The Shop home orders them by how many editions they hold.",
  },
};

const PRINT_STATUS: Record<FeaturedPrintRole, HomeFeatureStatus> = {
  home_release: { tone: "success", label: "Used as the Shop home release" },
  next_in_line: { tone: "neutral", label: "Next in line" },
  sold_out: { tone: "warning", label: "Skipped: sold out" },
  no_image: { tone: "warning", label: "Skipped: no image" },
  not_live: { tone: "neutral", label: "Not on the Shop: draft or withdrawn" },
  beyond_candidates: {
    tone: "neutral",
    label: `Not used: the home reads the first ${HOME_RELEASE_CANDIDATE_LIMIT}`,
  },
};

const ARTIST_STATUS: Record<FeaturedArtistPresence, HomeFeatureStatus> = {
  on_art: { tone: "info", label: "On lax.art" },
  on_shop: { tone: "success", label: "On LAX Shop" },
  not_on_shop: { tone: "warning", label: "Not on Shop: no editions on sale" },
};

function categoryStatus(row: AdminHomeFeatureCategory): HomeFeatureStatus {
  if (row.editionCount === 0) return { tone: "warning", label: "Not shown: no editions on sale" };
  return {
    tone: "neutral",
    label: `${row.editionCount} ${row.editionCount === 1 ? "edition" : "editions"}`,
  };
}

/** Each slot's row view and status lines, so a new slot is one more entry. */
const SLOT_VIEWS: {
  [S in AdminHomeFeatureSlot]: {
    row(item: AdminHomeFeatureRow<S>): HomeFeatureRowView;
    statuses(items: readonly AdminHomeFeatureRow<S>[]): HomeFeatureStatus[][];
    /** A line for the picker, beside each search result. */
    pickerMeta(item: AdminHomeFeatureRow<S>): string | null;
  };
} = {
  featured_prints: {
    row: (item: AdminHomeFeaturePrint) => ({
      id: item.id,
      title: item.title,
      subtitle: item.artistName,
      image: { src: item.thumbnailUrl, missingLabel: "No image" },
    }),
    statuses: (items) => featuredPrintRoles(items).map((role) => [PRINT_STATUS[role]]),
    pickerMeta: (item) =>
      !item.live
        ? "Not on the Shop"
        : item.soldOut
          ? "Sold out"
          : item.hasImage
            ? null
            : "No image",
  },
  featured_artists: {
    row: (item: AdminHomeFeatureArtist) => ({
      id: item.id,
      title: item.name,
      subtitle: item.discipline,
      image: { src: item.portraitUrl, missingLabel: "No portrait" },
    }),
    statuses: (items) =>
      items.map((item) => featuredArtistPresence(item).map((presence) => ARTIST_STATUS[presence])),
    pickerMeta: (item) => (item.hasEditionsOnSale ? null : "No editions on sale"),
  },
  featured_categories: {
    row: (item: AdminHomeFeatureCategory) => ({
      id: item.id,
      title: item.name,
      subtitle: null,
      image: null,
    }),
    statuses: (items) => items.map((item) => [categoryStatus(item)]),
    pickerMeta: (item) => categoryStatus(item).label,
  },
};

export function homeFeatureRowView<S extends AdminHomeFeatureSlot>(
  slot: S,
  item: AdminHomeFeatureRow<S>,
): HomeFeatureRowView {
  return SLOT_VIEWS[slot].row(item);
}

/** Each row's status line, in list order: the rules read the whole list, so order matters. */
export function homeFeatureStatuses<S extends AdminHomeFeatureSlot>(
  slot: S,
  items: readonly AdminHomeFeatureRow<S>[],
): HomeFeatureStatus[][] {
  return SLOT_VIEWS[slot].statuses(items);
}

export function homeFeaturePickerMeta<S extends AdminHomeFeatureSlot>(
  slot: S,
  item: AdminHomeFeatureRow<S>,
): string | null {
  return SLOT_VIEWS[slot].pickerMeta(item);
}

export { homeFeatureLimit };

const ISSUE_MESSAGE: Record<HomeFeatureIssueReason, (noun: string) => string> = {
  unknown: (noun) => `This ${noun} no longer exists. Remove it to save.`,
  duplicate: (noun) => `This ${noun} is already in the list.`,
  not_a_shop_edition: () => "This is not a Shop edition. Only editions can lead the Shop home.",
  over_limit: (noun) => `Past the limit for this list. Remove a ${noun} to save.`,
};

/** The problem with each row, keyed by the row's id. */
export function homeFeatureIssueMessages(
  slot: AdminHomeFeatureSlot,
  issues: readonly Pick<AdminHomeFeatureIssue, "targetId" | "reason">[],
): Map<string, string> {
  const noun = HOME_FEATURE_SLOT_COPY[slot].noun;
  return new Map(issues.map((issue) => [issue.targetId, ISSUE_MESSAGE[issue.reason](noun)]));
}

/** The list's problems before it is sent: a record twice, or more than the slot holds. */
export function homeFeatureDraftIssues(
  slot: AdminHomeFeatureSlot,
  ids: readonly string[],
): AdminHomeFeatureIssue[] {
  return homeFeatureListIssues(slot, ids);
}

const ISSUE_REASONS: ReadonlySet<string> = new Set<HomeFeatureIssueReason>([
  "unknown",
  "duplicate",
  "not_a_shop_edition",
  "over_limit",
]);

/** The row issues in a refused save, from the response's `issues`; anything else is dropped. */
export function readHomeFeatureIssues(value: unknown): AdminHomeFeatureIssue[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const { index, targetId, reason } = entry as Record<string, unknown>;
    if (typeof index !== "number" || typeof targetId !== "string") return [];
    if (typeof reason !== "string" || !ISSUE_REASONS.has(reason)) return [];
    return [{ index, targetId, reason: reason as HomeFeatureIssueReason }];
  });
}

export function sameOrder(a: readonly { id: string }[], b: readonly { id: string }[]): boolean {
  return a.length === b.length && a.every((item, index) => item.id === b[index]?.id);
}
