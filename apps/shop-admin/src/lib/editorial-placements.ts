import { isUuid } from "./editorial-entity-forms";
import { HREF_RULE_MESSAGE, isAllowedEditorialHref } from "./editorial-validation";

export const EDITORIAL_PLACEMENT_SLOTS = [
  "home_hero",
  "home_whats_on",
  "home_stories",
  "home_guide",
  "art_hub_spotlight",
  "collector_hub_card",
] as const;
export type EditorialPlacementSlot = (typeof EDITORIAL_PLACEMENT_SLOTS)[number];

export const PLACEMENT_SLOT_LABELS: Record<EditorialPlacementSlot, string> = {
  home_hero: "Home · hero",
  home_whats_on: "Home · what's on",
  home_stories: "Home · stories",
  home_guide: "Home · guide",
  art_hub_spotlight: "Art hub · spotlight",
  collector_hub_card: "Collector hub · card",
};

export const PLACEMENT_REF_KINDS = ["exhibition", "story", "page", "venue", "external"] as const;
export type PlacementRefKind = (typeof PLACEMENT_REF_KINDS)[number];

/** shop-api accepts positions 0–50. */
export const PLACEMENT_MAX_ROWS = 51;

export type AdminPlacementRow = {
  id: string;
  slot: string;
  position: number;
  refKind: string;
  refId: string | null;
  headline: string | null;
  mediaKey: string | null;
  linkUrl: string | null;
  publishedAt: string | null;
};

export type PlacementDraft = {
  key: string;
  refKind: PlacementRefKind;
  refId: string;
  headline: string;
  mediaKey: string | null;
  linkUrl: string;
};

export type PlacementWriteItem = {
  position: number;
  refKind: PlacementRefKind;
  refId: string | null;
  headline: string | null;
  mediaKey: string | null;
  linkUrl: string | null;
};

function isSlot(value: string): value is EditorialPlacementSlot {
  return (EDITORIAL_PLACEMENT_SLOTS as readonly string[]).includes(value);
}

function isRefKind(value: string): value is PlacementRefKind {
  return (PLACEMENT_REF_KINDS as readonly string[]).includes(value);
}

export function emptyPlacementDraft(key: string): PlacementDraft {
  return { key, refKind: "exhibition", refId: "", headline: "", mediaKey: null, linkUrl: "" };
}

export function placementDraftsBySlot(
  rows: readonly AdminPlacementRow[],
  makeKey: () => string,
): Record<EditorialPlacementSlot, PlacementDraft[]> {
  const grouped = Object.fromEntries(
    EDITORIAL_PLACEMENT_SLOTS.map((slot) => [slot, [] as PlacementDraft[]]),
  ) as Record<EditorialPlacementSlot, PlacementDraft[]>;
  const sorted = [...rows].sort((a, b) => a.position - b.position);
  for (const row of sorted) {
    if (!isSlot(row.slot) || !isRefKind(row.refKind)) continue;
    grouped[row.slot].push({
      key: makeKey(),
      refKind: row.refKind,
      refId: row.refId ?? "",
      headline: row.headline ?? "",
      mediaKey: row.mediaKey,
      linkUrl: row.linkUrl ?? "",
    });
  }
  return grouped;
}

export type PlacementPayloadResult =
  | { ok: true; payload: { items: PlacementWriteItem[] } }
  | { ok: false; errors: string[] };

export function buildPlacementSlotPayload(
  drafts: readonly PlacementDraft[],
): PlacementPayloadResult {
  const errors: string[] = [];
  if (drafts.length > PLACEMENT_MAX_ROWS) {
    errors.push(`A slot can hold at most ${PLACEMENT_MAX_ROWS} rows.`);
  }
  const items = drafts.map((draft, position): PlacementWriteItem => {
    const row = `Row ${position + 1}`;
    const linkUrl = draft.linkUrl.trim();
    const refId = draft.refId.trim();
    if (draft.refKind === "external") {
      if (!linkUrl) errors.push(`${row}: external rows need a link URL.`);
    } else if (!isUuid(refId)) {
      errors.push(`${row}: choose which ${draft.refKind} to feature.`);
    }
    if (linkUrl && !isAllowedEditorialHref(linkUrl)) {
      errors.push(`${row}: link ${HREF_RULE_MESSAGE}.`);
    }
    return {
      position,
      refKind: draft.refKind,
      refId: draft.refKind === "external" ? null : refId || null,
      headline: draft.headline.trim() || null,
      mediaKey: draft.mediaKey,
      linkUrl: linkUrl || null,
    };
  });
  return errors.length > 0 ? { ok: false, errors } : { ok: true, payload: { items } };
}
