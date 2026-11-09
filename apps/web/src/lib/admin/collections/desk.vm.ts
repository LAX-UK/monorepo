import { addDaysToKey, formatCollectionDay } from "@auction/domain";
import { formatStaffTime } from "@auction/staff-ui";
import type { DeskBookingView, DeskGroupView, DeskIdType, DeskLotView } from "@auction/types";

/** The photo ID types staff can record. Only the type is ever kept, never the number or a copy. */
export const ID_TYPE_OPTIONS: ReadonlyArray<{ value: DeskIdType; label: string }> = [
  { value: "passport", label: "Passport" },
  { value: "driving_licence", label: "Driving licence" },
  { value: "national_identity_card", label: "National identity card" },
  { value: "other_photo_id", label: "Other photo ID" },
];

export const idTypeLabel = (type: DeskIdType): string =>
  ID_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? "Photo ID";

/** A London day key as a date to format; noon keeps it on the same day in any zone. */
const dayDate = (day: string): Date => new Date(`${day}T12:00:00Z`);

/** "Thu 12 Nov", with the year only when it is not this year. */
export function deskDayLabel(day: string, now: Date = new Date()): string {
  return formatCollectionDay(dayDate(day), now);
}

export const nextDay = (day: string): string => addDaysToKey(day, 1);
export const previousDay = (day: string): string => addDaysToKey(day, -1);

/** "14:00–14:30" for a time. */
export function timeRange(group: Pick<DeskGroupView, "start" | "end">): string {
  return `${formatStaffTime(group.start)}–${formatStaffTime(group.end)}`;
}

/** "2 of 2 booked". */
export function placesLabel(group: Pick<DeskGroupView, "taken" | "capacity">): string {
  return `${group.taken} of ${group.capacity} booked`;
}

export type DeskTone = "neutral" | "info" | "success" | "warning" | "danger";

export const BOOKING_BADGES: Record<DeskBookingView["status"], { label: string; tone: DeskTone }> =
  {
    booked: { label: "Booked", tone: "info" },
    collected: { label: "Collected", tone: "success" },
    partly_collected: { label: "Partly collected", tone: "warning" },
    not_collected: { label: "Not collected", tone: "warning" },
    cancelled: { label: "Cancelled", tone: "neutral" },
  };

/** What staff read about a lot's readiness: released and ready are fine, anything else waits. */
export function lotReadiness(lot: Pick<DeskLotView, "fulfilmentStatus" | "released">): {
  label: string;
  tone: DeskTone;
} {
  if (lot.fulfilmentStatus === "ready_for_collection") return { label: "Ready", tone: "success" };
  if (lot.released) return { label: "Released", tone: "success" };
  return { label: "Release first", tone: "warning" };
}

/** The lots that still wait for release, among those a hand-over would include. */
export function unreleasedLots(lots: readonly DeskLotView[]): DeskLotView[] {
  return lots.filter((lot) => !lot.released);
}

/** "Lot 4 · Coastal Notation". */
export const lotLabel = (lot: Pick<DeskLotView, "lotNumber" | "title">): string =>
  lot.lotNumber === null ? lot.title : `Lot ${lot.lotNumber} · ${lot.title}`;

/** "Mark 2 lots collected" / "Mark Coastal Notation collected". */
export function markCollectedLabel(lots: readonly Pick<DeskLotView, "title">[]): string {
  if (lots.length === 1) return `Mark ${lots[0]?.title ?? "the lot"} collected`;
  return `Mark ${lots.length} lots collected`;
}

/** Why hand-over is blocked, or null when it is not: the sentence the button's tooltip gives. */
export function handOverBlock(input: {
  ticked: readonly DeskLotView[];
  idChecked: boolean;
}): string | null {
  if (input.ticked.length === 0) return "Tick at least one lot.";
  const waiting = unreleasedLots(input.ticked);
  if (waiting.length > 0) {
    return waiting.length === 1
      ? `Release ${waiting[0]?.title ?? "the lot"} first.`
      : `Release ${waiting.length} lots first.`;
  }
  return input.idChecked ? null : "Confirm the photo ID check first.";
}

/** A fresh key for one attempt; reused when the same attempt is sent again. */
export function newAttemptKey(): string {
  return globalThis.crypto.randomUUID();
}

/** The sentence for a refused desk action, by the API's code. */
export function deskRefusalMessage(
  code: string | undefined,
  fallback: string,
  meta?: Record<string, unknown>,
): string {
  switch (code) {
    case "not_released":
      return "Release every ticked lot before handing it over.";
    case "hold_open":
      return "A check has opened on this purchase since it was booked, so it can't be handed over yet. Ask Compliance or Finance.";
    case "undo_window_passed":
      return "It's too late to undo this hand-over.";
    case "too_early":
      return "A visit can be marked not collected once its time has started.";
    case "booking_changed":
      return "This collection changed while you were looking. It has been reloaded: check it and try again.";
    case "fulfilment_failed":
      return "A lot's fulfilment wouldn't move, so nothing was handed over. Try again, or check the lot in Lot fulfilment.";
    case "slot_full":
      return "That time is full. Add a reason to book over capacity.";
    case "notice_passed":
      return "That time is inside the notice period. Add a reason to book it.";
    case "lot_not_collectable":
      return typeof meta?.reason === "string"
        ? fallback
        : "One of those lots can't be booked for collection.";
    default:
      return fallback;
  }
}
