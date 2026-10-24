import type {
  EditorialExhibitionLinkList,
  EditorialLinkItem,
  EditorialLinkKind,
  EditorialStoryLinkList,
} from "@auction/shop-contracts";

/** The most items any public rail on lax.art shows; longer lists are still stored in full. */
export const PUBLIC_RAIL_LIMIT = 24;

export type EditorialLinkParent = "exhibitions" | "stories";
export type EditorialLinkList = EditorialExhibitionLinkList | EditorialStoryLinkList;

/** One related record as a list shows it. `id` is whatever the caller identifies records by. */
export type RelationRow = {
  id: string;
  title: string;
  /** A second line that tells similar records apart, such as the address it lives at. */
  subtitle?: string;
  /** True when the public site cannot show it yet. */
  notPublic?: boolean;
};

/** A linked record as the picker shows it. `slug` stays so the public address is visible. */
export type LinkRow = RelationRow & { slug: string };

export type LinkSectionSpec = {
  list: EditorialLinkList;
  /** What is searched for when adding to this list. */
  candidateKind: EditorialLinkKind;
  heading: string;
  description: string;
  /** Plural noun for sentences, e.g. "artworks". */
  noun: string;
  /** The same noun in the singular, e.g. "artwork". */
  singular: string;
  saveLabel: string;
  /** False for sets whose order is not stored. */
  ordered: boolean;
};

export const EXHIBITION_LINK_SECTIONS: readonly LinkSectionSpec[] = [
  {
    list: "artworks",
    candidateKind: "artwork",
    heading: "Artworks in this exhibition",
    description: "Shown in this order on the exhibition page.",
    noun: "artworks",
    singular: "artwork",
    saveLabel: "Save artworks",
    ordered: true,
  },
  {
    list: "artists",
    candidateKind: "artist",
    heading: "Artists",
    description: "Shown in this order on the exhibition page.",
    noun: "artists",
    singular: "artist",
    saveLabel: "Save artists",
    ordered: true,
  },
  {
    list: "stories",
    candidateKind: "story",
    heading: "Related stories",
    description: "Stories that appear alongside this exhibition. lax.art orders them by date.",
    noun: "stories",
    singular: "story",
    saveLabel: "Save related stories",
    ordered: false,
  },
];

export const STORY_LINK_SECTIONS: readonly LinkSectionSpec[] = [
  {
    list: "artists",
    candidateKind: "artist",
    heading: "Artists",
    description: "Shown in this order on the story page.",
    noun: "artists",
    singular: "artist",
    saveLabel: "Save artists",
    ordered: true,
  },
  {
    list: "artworks",
    candidateKind: "artwork",
    heading: "Artworks",
    description: "Shown in this order on the story page.",
    noun: "artworks",
    singular: "artwork",
    saveLabel: "Save artworks",
    ordered: true,
  },
  {
    list: "exhibitions",
    candidateKind: "exhibition",
    heading: "Exhibitions",
    description: "Exhibitions this story relates to. lax.art orders them by date.",
    noun: "exhibitions",
    singular: "exhibition",
    saveLabel: "Save exhibitions",
    ordered: false,
  },
];

export function linkSectionsFor(parent: EditorialLinkParent): readonly LinkSectionSpec[] {
  return parent === "exhibitions" ? EXHIBITION_LINK_SECTIONS : STORY_LINK_SECTIONS;
}

export function toLinkRow(item: EditorialLinkItem): LinkRow {
  return {
    id: item.id,
    title: item.title,
    slug: item.slug,
    subtitle: `/${item.slug}`,
    notPublic: !item.published,
  };
}

/** What the links GET returns for either parent, keyed by list. */
export type LinksPayload = Partial<Record<EditorialLinkList, readonly EditorialLinkItem[]>> & {
  version: string;
};

export type LinksState = {
  /** One token for all of the parent's lists; every save sends it and gets a new one back. */
  version: string;
  saved: Partial<Record<EditorialLinkList, LinkRow[]>>;
  current: Partial<Record<EditorialLinkList, LinkRow[]>>;
};

function rowsByList(
  payload: LinksPayload,
  specs: readonly LinkSectionSpec[],
): Partial<Record<EditorialLinkList, LinkRow[]>> {
  return Object.fromEntries(
    specs.map((spec) => [spec.list, (payload[spec.list] ?? []).map(toLinkRow)]),
  );
}

export function initialLinksState(
  payload: LinksPayload,
  specs: readonly LinkSectionSpec[],
): LinksState {
  const rows = rowsByList(payload, specs);
  return { version: payload.version, saved: rows, current: rows };
}

export function editLinkList(
  state: LinksState,
  list: EditorialLinkList,
  items: LinkRow[],
): LinksState {
  return { ...state, current: { ...state.current, [list]: items } };
}

/** The list now matches the store, under the version the save returned. */
export function markLinkListSaved(
  state: LinksState,
  list: EditorialLinkList,
  version: string,
): LinksState {
  const items = state.current[list] ?? [];
  return { ...state, version, saved: { ...state.saved, [list]: items } };
}

/**
 * Takes the stored lists after a conflict. `discard` is the list the editor chose to reload and
 * loses its edits; other lists keep theirs, compared against the new stored contents, so an edit
 * to one list is never thrown away by reloading another.
 */
export function adoptStoredLinks(
  state: LinksState,
  payload: LinksPayload,
  specs: readonly LinkSectionSpec[],
  discard: EditorialLinkList,
): LinksState {
  const stored = rowsByList(payload, specs);
  const current = { ...stored };
  for (const spec of specs) {
    if (spec.list !== discard && isLinkListDirty(state, spec)) {
      current[spec.list] = state.current[spec.list] ?? [];
    }
  }
  return { version: payload.version, saved: stored, current };
}

const idsOf = (items: readonly LinkRow[] | undefined): string[] =>
  (items ?? []).map((item) => item.id);

/** Whether a list differs from what is stored; for unordered sets only membership counts. */
export function isLinkListDirty(state: LinksState, spec: LinkSectionSpec): boolean {
  const saved = idsOf(state.saved[spec.list]);
  const current = idsOf(state.current[spec.list]);
  if (saved.length !== current.length) return true;
  if (spec.ordered) return saved.some((id, index) => id !== current[index]);
  const savedSet = new Set(saved);
  return current.some((id) => !savedSet.has(id));
}

export function anyLinkListDirty(state: LinksState, specs: readonly LinkSectionSpec[]): boolean {
  return specs.some((spec) => isLinkListDirty(state, spec));
}

/** The ids to send; an unordered set is sent as it stands since its order is ignored. */
export function linkListIds(state: LinksState, list: EditorialLinkList): string[] {
  return idsOf(state.current[list]);
}

export function publicRailNote(spec: LinkSectionSpec, count: number): string | null {
  if (count <= PUBLIC_RAIL_LIMIT) return null;
  return spec.ordered
    ? `Only the first ${PUBLIC_RAIL_LIMIT} appear on lax.art.`
    : `Only ${PUBLIC_RAIL_LIMIT} of these appear on lax.art.`;
}

/** Names the rejected records from the list being saved; ids it cannot name are counted. */
export function unknownRecordsMessage(
  spec: LinkSectionSpec,
  missingIds: readonly string[],
  items: readonly LinkRow[],
): string {
  const titles = items
    .filter((item) => missingIds.includes(item.id))
    .map((item) => `“${item.title}”`);
  const unnamed = missingIds.length - titles.length;
  const parts = unnamed > 0 ? [...titles, `${unnamed} more that could not be named`] : titles;
  const single = missingIds.length === 1;
  return `Could not save ${spec.noun}: ${parts.join(", ")} ${single ? "does" : "do"} not exist any more. Remove ${single ? "it" : "them"} from the list and save again.`;
}
