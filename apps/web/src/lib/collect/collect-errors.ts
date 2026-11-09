import { COLLECT_COPY } from "./collect-copy";
import { type CollectionRefusal, collectionRefusalSchema } from "./collect.schema";

/**
 * Every way the API turns a booking away, as the page shows it. The `kind` says what the page does
 * about it: some keep the person's choices and refresh the times, some only say it, and the rest
 * name a field or a lot. A sentence the API sent is shown as it is; the codes below choose the
 * treatment.
 */
export type CollectFailure =
  /** The time went to someone else: keep everything, refresh the times, pick again. */
  | { kind: "slot_taken"; title: string; message: string; refresh: true }
  /** The notice period has passed for this time (booking) or for the visit (changing). */
  | { kind: "too_late"; message: string; refresh: boolean }
  /** A lot cannot be booked: say which and why. */
  | { kind: "lot"; lotId: string | null; reason: string | null; message: string }
  /** The collector's details were refused; each issue belongs to a field. */
  | { kind: "collector"; issues: { fieldId: string; message: string }[]; message: string }
  /** Online booking is off for the place: show the email route. */
  | { kind: "off"; bookingEmail: string | null; message: string }
  /** The visit changed since it was read: reload it. */
  | { kind: "changed"; message: string }
  /** The person is viewing the account, or has no right to do this. */
  | { kind: "forbidden"; message: string; viewOnly: boolean }
  | { kind: "rate_limited"; message: string }
  | { kind: "unavailable"; message: string }
  | { kind: "other"; message: string };

const ISSUE_FIELDS: Record<string, string> = {
  name: "collect-collector-name",
  email: "collect-collector-email",
  authorisation: "collect-collector-authorisation",
};

function text(refusal: CollectionRefusal, fallback: string): string {
  return refusal.message && refusal.message.trim() !== "" ? refusal.message : fallback;
}

/** Turns an API refusal (its status and body) into what the page does and says. */
export function collectFailure(
  status: number,
  body: unknown,
  takenAt: string | null,
): CollectFailure {
  if (status === 429) return { kind: "rate_limited", message: COLLECT_COPY.rateLimited };
  const parsed = collectionRefusalSchema.safeParse(body);
  if (!parsed.success) {
    return status >= 500
      ? { kind: "unavailable", message: COLLECT_COPY.unavailable }
      : { kind: "other", message: COLLECT_COPY.unavailable };
  }
  const refusal = parsed.data;
  switch (refusal.error) {
    case "slot_full":
    case "slot_unknown":
      return {
        kind: "slot_taken",
        title: COLLECT_COPY.taken.title,
        message: takenAt
          ? COLLECT_COPY.taken.body(takenAt)
          : "Someone booked the last place a moment ago. Your lots and details are kept: pick another time.",
        refresh: true,
      };
    case "notice_passed":
      return { kind: "too_late", message: COLLECT_COPY.tooLate.book, refresh: true };
    case "cutoff_passed":
    case "booking_closed":
      return { kind: "too_late", message: COLLECT_COPY.tooLate.change, refresh: false };
    case "lot_not_collectable":
    case "lot_not_yours_to_book":
    case "lot_not_found":
    case "lot_without_place":
      return {
        kind: "lot",
        lotId: refusal.lotId ?? null,
        reason: refusal.reason ?? null,
        message: text(refusal, COLLECT_COPY.unavailable),
      };
    case "no_lots":
    case "too_many_lots":
    case "duplicate_lots":
    case "mixed_places":
      return {
        kind: "lot",
        lotId: null,
        reason: refusal.error,
        message: text(refusal, COLLECT_COPY.errors.lots),
      };
    case "collector_invalid":
      return {
        kind: "collector",
        issues: (refusal.issues ?? []).map((issue) => ({
          fieldId: ISSUE_FIELDS[issue.field] ?? "collect-collector-name",
          message: issue.message,
        })),
        message: text(refusal, "Check who is collecting."),
      };
    case "online_booking_off":
      return {
        kind: "off",
        bookingEmail: refusal.bookingEmail ?? null,
        message: text(refusal, COLLECT_COPY.off.body),
      };
    case "booking_changed":
    case "booking_not_found":
    case "idempotency_key_reused":
      return { kind: "changed", message: text(refusal, COLLECT_COPY.unavailable) };
    case "read_only":
      return {
        kind: "forbidden",
        message: text(refusal, COLLECT_COPY.viewOnly.body),
        viewOnly: true,
      };
    case "insufficient_entity_role":
      return {
        kind: "forbidden",
        message: text(refusal, COLLECT_COPY.unavailable),
        viewOnly: false,
      };
    case "unavailable":
      return { kind: "unavailable", message: text(refusal, COLLECT_COPY.unavailable) };
    default:
      return { kind: "other", message: text(refusal, COLLECT_COPY.unavailable) };
  }
}
