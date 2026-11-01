import {
  COVER_SLOT_FLOORS,
  type CoverBoxName,
  type CoverSlotIssue,
  validateCoverSlot,
} from "@auction/domain";
import { isoToLondonWallTime, londonWallTimeToIso } from "@auction/staff-ui";
import {
  type CoverTextSide,
  type CoverTextTone,
  SALE_COVER_SLOT_NAMES,
  SALE_HOME_PINS_MAX,
  type SaleCoverSlot,
  type SaleCoverSlotName,
  type UnitPoint,
  type UnitRect,
} from "@auction/types";
import type { SetSaleCoverSlotBody, UpdateSaleHomeBody } from "@auction/validators";
import type { CoverLotOption, CoverView } from "./cover-view";

/** Where a slot's picture comes from: an upload, or a detail of one lot photograph. */
export type CoverSource =
  | { kind: "upload"; key: string }
  | { kind: "lot"; lotId: string; imageIndex: number; crop?: UnitRect };

/** What staff are editing for one slot. */
export type SlotDraft = {
  source: CoverSource;
  /** Storage key of the picture to show in the editor. */
  pictureKey: string;
  /** Pixel size of the source after any lot crop; null until the picture has been measured. */
  size: { width: number; height: number } | null;
  focal: UnitPoint;
  keep?: UnitRect;
  zoom: number;
  alt: string;
  toneOverride?: CoverTextTone;
  sideOverride?: CoverTextSide;
};

/** A change to a slot draft; an explicit `undefined` clears an optional value. */
export type SlotPatch = { [K in keyof SlotDraft]?: SlotDraft[K] | undefined };

export type HomeDraft = {
  subtitle: string;
  featuredLotIds: string[];
  pinned: boolean;
  /** London calendar day, `YYYY-MM-DD`, or null. */
  consignmentDay: string | null;
};

export type CoverDraft = {
  slots: Partial<Record<SaleCoverSlotName, SlotDraft>>;
  home: HomeDraft;
};

/** What a save will send, one call per changed part. */
export type CoverSavePlan = {
  puts: { name: SaleCoverSlotName; body: SetSaleCoverSlotBody }[];
  clears: SaleCoverSlotName[];
  home: UpdateSaleHomeBody | null;
  /** The whole ordered pin list, when this sale's pin changed. */
  pins: string[] | null;
};

export const DEFAULT_FOCAL: UnitPoint = { x: 0.5, y: 0.5 };

/** Titles longer than this step down in size on the home cover. */
export const COVER_TITLE_COMFORTABLE_LENGTH = 40;

/** The most pins the home page holds, and whether this sale may take a place. */
export function canTakePinPlace(view: CoverView, alreadyPinned: boolean): boolean {
  return alreadyPinned || view.pins.length < SALE_HOME_PINS_MAX;
}

export function sourceFromView(
  slot: SaleCoverSlot,
  lots: readonly CoverLotOption[],
): { source: CoverSource; pictureKey: string } {
  if (slot.fromLot) {
    const { lotId, imageKey, crop } = slot.fromLot;
    const photos = lots.find((lot) => lot.id === lotId)?.images ?? [];
    // A lot's pictures reach the page as addresses; the stored key is the end of its address.
    const found = photos.findIndex((photo) => photo === imageKey || photo.endsWith(`/${imageKey}`));
    return {
      source: {
        kind: "lot",
        lotId,
        imageIndex: found >= 0 ? found : 0,
        ...(crop ? { crop } : {}),
      },
      pictureKey: imageKey,
    };
  }
  const key = slot.key ?? "";
  return { source: { kind: "upload", key }, pictureKey: key };
}

export function draftFromView(view: CoverView, lots: readonly CoverLotOption[]): CoverDraft {
  const slots: CoverDraft["slots"] = {};
  for (const name of SALE_COVER_SLOT_NAMES) {
    const stored = view.slots[name]?.slot;
    if (!stored) continue;
    slots[name] = {
      ...sourceFromView(stored, lots),
      size: { width: stored.width, height: stored.height },
      focal: stored.focal,
      ...(stored.keep ? { keep: stored.keep } : {}),
      zoom: stored.zoom,
      alt: stored.alt,
      ...(stored.toneOverride ? { toneOverride: stored.toneOverride } : {}),
      ...(stored.sideOverride ? { sideOverride: stored.sideOverride } : {}),
    };
  }
  const { home } = view;
  return {
    slots,
    home: {
      subtitle: home.subtitle ?? "",
      featuredLotIds: home.featuredLotIds,
      pinned: home.homePinOrder !== null,
      consignmentDay: home.consignmentDeadline
        ? (isoToLondonWallTime(home.consignmentDeadline)?.day ?? null)
        : null,
    },
  };
}

/** A fresh draft for a slot staff have just filled. */
export function newSlotDraft(
  source: CoverSource,
  pictureKey: string,
  size: SlotDraft["size"],
): SlotDraft {
  return { source, pictureKey, size, focal: DEFAULT_FOCAL, zoom: 1, alt: "" };
}

export function slotBody(draft: SlotDraft): SetSaleCoverSlotBody {
  return {
    source: draft.source,
    focal: draft.focal,
    ...(draft.keep ? { keep: draft.keep } : {}),
    zoom: draft.zoom,
    alt: draft.alt.trim(),
    ...(draft.toneOverride ? { toneOverride: draft.toneOverride } : {}),
    ...(draft.sideOverride ? { sideOverride: draft.sideOverride } : {}),
  };
}

/** Consigning closes at the end of the chosen London day. */
function consignmentInstant(day: string | null): Date | null {
  const iso = day ? londonWallTimeToIso(day, "23:59") : null;
  return iso ? new Date(iso) : null;
}

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** The pin list after this sale takes or gives up its place; other sales keep their order. */
function nextPins(view: CoverView, pinned: boolean): string[] | null {
  const current = view.pins.map((pin) => pin.saleId);
  const isPinned = current.includes(view.saleId);
  if (pinned === isPinned) return null;
  return pinned ? [...current, view.saleId] : current.filter((id) => id !== view.saleId);
}

/** What changed between what was loaded and what staff now have. */
export function planCoverSave(
  view: CoverView,
  initial: CoverDraft,
  draft: CoverDraft,
): CoverSavePlan {
  const puts: CoverSavePlan["puts"] = [];
  const clears: SaleCoverSlotName[] = [];
  for (const name of SALE_COVER_SLOT_NAMES) {
    const before = initial.slots[name];
    const after = draft.slots[name];
    if (!after) {
      if (before) clears.push(name);
      continue;
    }
    const body = slotBody(after);
    if (!before || !sameJson(slotBody(before), body)) puts.push({ name, body });
  }

  const home: UpdateSaleHomeBody = {};
  const subtitle = draft.home.subtitle.trim();
  if (subtitle !== initial.home.subtitle.trim()) home.subtitle = subtitle === "" ? null : subtitle;
  if (!sameJson(draft.home.featuredLotIds, initial.home.featuredLotIds)) {
    home.featuredLotIds = draft.home.featuredLotIds;
  }
  if (draft.home.consignmentDay !== initial.home.consignmentDay) {
    home.consignmentDeadline = consignmentInstant(draft.home.consignmentDay);
  }

  return {
    puts,
    clears,
    home: Object.keys(home).length > 0 ? home : null,
    pins: draft.home.pinned === initial.home.pinned ? null : nextPins(view, draft.home.pinned),
  };
}

export function isPlanEmpty(plan: CoverSavePlan): boolean {
  return (
    plan.puts.length === 0 && plan.clears.length === 0 && plan.home === null && plan.pins === null
  );
}

// ─── Checks before saving ─────────────────────────────────────────────────────

/** The slot as the server stores it, for the same checks it will run. */
function asStoredSlot(draft: SlotDraft): SaleCoverSlot | null {
  if (!draft.size) return null;
  return {
    ...(draft.source.kind === "upload" ? { key: draft.source.key } : {}),
    width: draft.size.width,
    height: draft.size.height,
    focal: draft.focal,
    ...(draft.keep ? { keep: draft.keep } : {}),
    zoom: draft.zoom,
    alt: draft.alt,
    ...(draft.toneOverride ? { toneOverride: draft.toneOverride } : {}),
    ...(draft.sideOverride ? { sideOverride: draft.sideOverride } : {}),
    analysisHash: "",
  };
}

/** The size and keep-area problems the server would refuse, found before saving. */
export function slotIssues(
  name: SaleCoverSlotName,
  draft: SlotDraft,
  phoneSlotPresent: boolean,
): CoverSlotIssue[] {
  const stored = asStoredSlot(draft);
  return stored ? validateCoverSlot(name, stored, { phoneSlotPresent }) : [];
}

const SLOT_LABEL: Record<SaleCoverSlotName, string> = {
  default: "default",
  wide: "wide",
  phone: "phone",
};

const BOX_LABEL: Record<CoverBoxName, string> = {
  desktop: "desktop",
  wide: "wide-screen",
  phone: "phone",
};

/** What a slot does when it cannot be used, said to the person who set it. */
const FALLBACK: Record<SaleCoverSlotName, string> = {
  default: "Until then the home page falls back to the plate of the lead lot.",
  wide: "Wide screens show the default picture meanwhile.",
  phone: "Phones show a crop of the default picture meanwhile.",
};

export function describeSlotIssue(name: SaleCoverSlotName, issue: CoverSlotIssue): string {
  if (issue.code === "below_floor") {
    const floor = COVER_SLOT_FLOORS[name];
    const need = floor.minHeight
      ? `${floor.minWidth} × ${floor.minHeight}`
      : `${floor.minWidth}px wide`;
    return `The ${SLOT_LABEL[name]} picture is ${issue.have.width} × ${issue.have.height}px after the zoom and needs at least ${need}. Use a larger picture or less zoom to save it. ${FALLBACK[name]}`;
  }
  return `The ${BOX_LABEL[issue.box]} crop cuts the area to keep in frame. Move the focal point, zoom out or use the other text side.`;
}

export function missingAltMessage(draft: SlotDraft): string | null {
  return draft.alt.trim() === "" ? "Describe the picture for screen readers." : null;
}

/** A title this long steps down in size on the home cover; staff are told to split it. */
export function titleLengthWarning(title: string): string | null {
  const length = title.trim().length;
  if (length <= COVER_TITLE_COMFORTABLE_LENGTH) return null;
  return `The sale title is ${length} characters. Over ${COVER_TITLE_COMFORTABLE_LENGTH} it steps down in size on the cover. Keep the title short and put the rest in the subtitle.`;
}

/** Moves one entry of a list to another place, returning a new list. */
export function moveEntry<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const [moved] = next.splice(from, 1);
  if (moved === undefined || to < 0 || to > next.length) return [...list];
  next.splice(to, 0, moved);
  return next;
}

/** Everything a slot draft needs to be saved, or the reason it cannot be yet. */
export function slotBlockers(
  name: SaleCoverSlotName,
  draft: SlotDraft,
  phoneSlotPresent: boolean,
): string[] {
  const reasons = slotIssues(name, draft, phoneSlotPresent).map((issue) =>
    describeSlotIssue(name, issue),
  );
  const alt = missingAltMessage(draft);
  return alt ? [alt, ...reasons] : reasons;
}
