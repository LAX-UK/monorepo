import type { DataRequestRecord } from "@auction/identity-contracts/data-requests";
import type { TimelineEvent } from "@auction/staff-ui";
import {
  CHANNEL_LABELS,
  OUTCOME_LABELS,
  PRODUCT_DETAILS,
  REASON_LABELS,
  TOLD_VIA_LABELS,
  formatDay,
} from "./data-requests.vm";

type Entry = DataRequestRecord["timeline"][number];
type Detail = Entry["detail"];
type Value = string | number | boolean | null | undefined;

type EventSpec = {
  title: (detail: Detail, actor: string | null) => string;
  /** A second line from the audited detail; ids, dates and codes only. */
  note?: (detail: Detail) => string | null;
  tone?: TimelineEvent["tone"];
};

const str = (value: Value): string | null => (typeof value === "string" ? value : null);
const num = (value: Value): number | null => (typeof value === "number" ? value : null);
const by = (actor: string | null) => (actor ? ` by ${actor}` : "");

function productName(detail: Detail): string {
  const product = str(detail.product);
  return product && product in PRODUCT_DETAILS
    ? PRODUCT_DETAILS[product as keyof typeof PRODUCT_DETAILS].name
    : "A product";
}

function day(value: Value): string | null {
  const text = str(value);
  return text && /^\d{4}-\d{2}-\d{2}$/.test(text) ? formatDay(text) : null;
}

function labelled<T extends string>(value: Value, labels: Record<T, string>): string | null {
  const text = str(value);
  return text && text in labels ? labels[text as T] : null;
}

const join = (parts: Array<string | null>) => parts.filter(Boolean).join(" · ") || null;

/** One row per audit event the screen knows; an unknown event reads as a generic line, not a gap. */
const EVENTS: Readonly<Record<string, EventSpec>> = {
  "data_export.requested": { title: () => "Requested in LAX Account" },
  "data_export.product_collected": {
    title: (detail) => `${productName(detail)} collected`,
    note: (detail) => {
      const categories = num(detail.categories);
      const records = num(detail.records);
      return join([
        categories === null
          ? null
          : `${categories} ${categories === 1 ? "category" : "categories"}`,
        records === null ? null : `${records.toLocaleString("en-GB")} records`,
      ]);
    },
    tone: "success",
  },
  "data_export.delayed": {
    title: (detail) => `${productName(detail)} didn't answer`,
    note: (detail) => str(detail.errorCode),
    tone: "danger",
  },
  "data_export.ready": { title: () => "The copy is ready", tone: "success" },
  "data_export.downloaded": { title: () => "The person downloaded their copy" },
  "data_export.expired": { title: () => "The copy expired and was removed" },
  "data_export.deleted_by_subject": { title: () => "The person deleted their copy" },
  "data_export.failed": {
    title: () => "The download failed",
    note: (detail) => str(detail.errorCode),
    tone: "danger",
  },
  "data_export.deadline_alert": {
    title: (detail) => {
      const tier = num(detail.tier);
      return tier === null ? "Deadline alert sent" : `Deadline alert sent (tier ${tier})`;
    },
  },
  "data_export.continued_manually": { title: (_, actor) => `Continued manually${by(actor)}` },
  "data_request.logged": {
    title: (_, actor) => `Logged${by(actor)}`,
    note: (detail) =>
      join([
        labelled(detail.reason, REASON_LABELS),
        labelled(detail.channel, CHANNEL_LABELS),
        day(detail.receivedOn) ? `received ${day(detail.receivedOn)}` : null,
        str(detail.continuedFrom) ? `continued from ${str(detail.continuedFrom)}` : null,
      ]),
  },
  "data_request.clock_started": {
    title: (_, actor) => `Proof of identity received${by(actor)}`,
    note: (detail) => (day(detail.dueOn) ? `Due ${day(detail.dueOn)}` : null),
  },
  "data_request.notes_edited": { title: (_, actor) => `Notes edited${by(actor)}` },
  "data_request.scope_changed": { title: (_, actor) => `Products changed${by(actor)}` },
  "data_request.contact_edited": { title: (_, actor) => `Contact details edited${by(actor)}` },
  "data_request.contact_cleared": { title: () => "Contact details cleared" },
  "data_request.product_gathered": {
    title: (detail, actor) => `${productName(detail)} marked gathered${by(actor)}`,
    tone: "success",
  },
  "data_request.product_ungathered": {
    title: (detail, actor) => `${productName(detail)} unmarked${by(actor)}`,
  },
  "data_request.extended": {
    title: (_, actor) => `Extended${by(actor)}`,
    note: (detail) =>
      join([
        day(detail.originalDueOn) && day(detail.extendedDueOn)
          ? `Due moves from ${day(detail.originalDueOn)} to ${day(detail.extendedDueOn)}`
          : null,
        day(detail.personToldOn)
          ? `Person told ${day(detail.personToldOn)}${
              labelled(detail.personToldVia, TOLD_VIA_LABELS)
                ? ` by ${labelled(detail.personToldVia, TOLD_VIA_LABELS)?.toLowerCase()}`
                : ""
            }`
          : null,
      ]),
  },
  "data_request.closed": {
    title: (_, actor) => `Closed${by(actor)}`,
    note: (detail) => {
      const late = num(detail.daysLate);
      return join([
        labelled(detail.outcome, OUTCOME_LABELS),
        late === null
          ? null
          : late === 0
            ? "On time"
            : `${late} ${late === 1 ? "day" : "days"} late`,
      ]);
    },
    tone: "success",
  },
};

function fallbackTitle(event: string): string {
  const name = event.split(".").pop() ?? event;
  const words = name.replace(/_/g, " ");
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}

/** The record's audit rows as the History timeline, newest first. */
export function dataRequestTimeline(entries: DataRequestRecord["timeline"]): TimelineEvent[] {
  return [...entries]
    .sort((a, b) => b.at.localeCompare(a.at))
    .map((entry, index) => {
      const spec = EVENTS[entry.event];
      const note = spec?.note?.(entry.detail) ?? null;
      const device = entry.device ? `${entry.device}` : null;
      const detail = join([note, device]);
      return {
        id: `${entry.event}-${entry.at}-${index}`,
        title: spec ? spec.title(entry.detail, entry.actorName) : fallbackTitle(entry.event),
        at: entry.at,
        ...(entry.actorName && !spec ? { actor: entry.actorName } : {}),
        ...(detail ? { detail } : {}),
        ...(spec?.tone ? { tone: spec.tone } : {}),
      };
    });
}
