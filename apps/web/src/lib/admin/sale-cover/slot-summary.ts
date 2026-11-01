import { COVER_SLOT_FLOORS } from "@auction/domain";
import type { SaleCoverSlotName } from "@auction/types";
import { type SlotDraft, slotIssues } from "./cover-draft";
import type { CoverLotOption, CoverSlotView } from "./cover-view";

export type SlotSummary = {
  title: string;
  /** One line under the title. */
  detail: string;
  /** The slot cannot be used as it is. */
  problem: boolean;
};

const TITLE: Record<SaleCoverSlotName, string> = {
  default: "Default",
  wide: "Wide (optional)",
  phone: "Phone (optional)",
};

const EMPTY_DETAIL: Record<SaleCoverSlotName, string> = {
  default: "Not set yet",
  wide: "Uses the default with its focal point",
  phone: "Uses a crop of the default",
};

function floorText(name: SaleCoverSlotName): string {
  const floor = COVER_SLOT_FLOORS[name];
  return floor.minHeight ? `${floor.minWidth} × ${floor.minHeight}` : `${floor.minWidth}`;
}

function sourceText(draft: SlotDraft, lots: readonly CoverLotOption[]): string {
  if (draft.source.kind === "upload") return "uploaded";
  const lotId = draft.source.lotId;
  const lot = lots.find((candidate) => candidate.id === lotId);
  return lot?.lotNumber != null ? `cover from lot ${lot.lotNumber}` : "cover from a lot";
}

/** What a slot's card says: its size and source, or what happens while it is empty. */
export function slotSummary(
  name: SaleCoverSlotName,
  draft: SlotDraft | undefined,
  saved: CoverSlotView | undefined,
  lots: readonly CoverLotOption[],
  phoneSlotPresent: boolean,
): SlotSummary {
  const title = TITLE[name];
  if (!draft) {
    return {
      title,
      detail: saved?.source === "legacy" ? "Picture from the old cover list" : EMPTY_DETAIL[name],
      problem: false,
    };
  }
  if (!draft.size) return { title, detail: sourceText(draft, lots), problem: false };
  const size = `${draft.size.width} × ${draft.size.height}`;
  const below = slotIssues(name, draft, phoneSlotPresent).some(
    (issue) => issue.code === "below_floor",
  );
  return below
    ? { title, detail: `${size} · needs ${floorText(name)} · not used`, problem: true }
    : { title, detail: `${size} · ${sourceText(draft, lots)}`, problem: false };
}
