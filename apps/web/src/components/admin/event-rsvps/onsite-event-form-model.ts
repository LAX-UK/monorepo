import type {
  OnsiteEventAdminDetail,
  OnsiteEventSegmentOption,
  OnsiteEventStatus,
} from "@auction/types";

export type EventFormSegment = {
  /** The stored key. Empty for a new row; derived from the label when the form is saved. */
  value: string;
  label: string;
  helper: string;
};

export type EventFormValues = {
  slug: string;
  title: string;
  status: OnsiteEventStatus;
  saleId: string | null;
  segments: EventFormSegment[];
  opsEmail: string;
  micrositeUrl: string;
  venue: string;
  dressCode: string;
  arrivalNote: string;
  /** ISO UTC instants; the form shows them in London time. */
  startsAt: string | null;
  rsvpCloseAt: string | null;
};

/** What staff pick for the event's state, by name. */
export const EVENT_STATUS_OPTIONS: ReadonlyArray<{
  value: OnsiteEventStatus;
  label: string;
  description: string;
}> = [
  { value: "draft", label: "Draft", description: "Not open to guests yet" },
  { value: "published", label: "Published", description: "Guests can RSVP" },
  { value: "closed", label: "RSVPs closed", description: "Guests can no longer RSVP" },
];

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const DEFAULT_SEGMENT: EventFormSegment = {
  value: "full_evening",
  label: "Full evening",
  helper: "",
};

export function emptySegment(): EventFormSegment {
  return { value: "", label: "", helper: "" };
}

function toSegmentRows(options: readonly OnsiteEventSegmentOption[]): EventFormSegment[] {
  return options.map((option) => ({
    value: option.value,
    label: option.label,
    helper: option.helper ?? "",
  }));
}

export function eventFormDefaults(initial: OnsiteEventAdminDetail | null): EventFormValues {
  return {
    slug: initial?.slug ?? "",
    title: initial?.title ?? "",
    status: initial?.status ?? "draft",
    saleId: initial?.saleId ?? null,
    segments: initial?.segmentOptions.length
      ? toSegmentRows(initial.segmentOptions)
      : [{ ...DEFAULT_SEGMENT }],
    opsEmail: initial?.opsEmail ?? "",
    micrositeUrl: initial?.micrositeUrl ?? "",
    venue: initial?.venue ?? "",
    dressCode: initial?.dressCode ?? "",
    arrivalNote: initial?.arrivalNote ?? "",
    startsAt: initial?.startsAt ?? null,
    rsvpCloseAt: initial?.rsvpCloseAt ?? null,
  };
}

/** The key stored for a new segment: its label in lowercase words joined by underscores. */
export function segmentKeyFromLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export type EventFormErrors = {
  slug?: string;
  title?: string;
  opsEmail?: string;
  micrositeUrl?: string;
  rsvpCloseAt?: string;
  /** The segment list as a whole: none left, or two with the same name. */
  segments?: string;
  /** Per row, by index. */
  segmentLabels: Record<number, string>;
};

function isWebAddress(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/** Every problem with the form, in the words staff read. Empty when it can be saved. */
export function validateEventForm(
  values: EventFormValues,
  mode: "create" | "edit",
): EventFormErrors {
  const errors: EventFormErrors = { segmentLabels: {} };

  if (mode === "create") {
    const slug = values.slug.trim();
    if (!slug) errors.slug = "Enter a slug, for example lax002";
    else if (!SLUG_PATTERN.test(slug)) {
      errors.slug = "Use lowercase letters, numbers and hyphens only, for example lax002";
    }
  }
  if (!values.title.trim()) errors.title = "Enter the event title";

  const email = values.opsEmail.trim();
  if (email && !EMAIL_PATTERN.test(email)) errors.opsEmail = "Enter a valid email address";

  const site = values.micrositeUrl.trim();
  if (site && !isWebAddress(site)) {
    errors.micrositeUrl = "Enter a full web address, for example https://event.lax.bid/lax002";
  }

  if (
    values.startsAt &&
    values.rsvpCloseAt &&
    new Date(values.rsvpCloseAt) > new Date(values.startsAt)
  ) {
    errors.rsvpCloseAt = "RSVPs must close before the event starts";
  }

  const filled = values.segments.filter((row) => row.label.trim() || row.helper.trim());
  if (filled.length === 0) {
    errors.segments = "Add at least one way to attend, for example Full evening";
  }
  const seen = new Set<string>();
  values.segments.forEach((row, index) => {
    const label = row.label.trim();
    if (!label) {
      if (row.helper.trim()) errors.segmentLabels[index] = "Enter a name for this option";
      return;
    }
    const key = label.toLowerCase();
    if (seen.has(key)) errors.segmentLabels[index] = "Each option needs a different name";
    seen.add(key);
  });
  return errors;
}

export function hasEventFormErrors(errors: EventFormErrors): boolean {
  return (
    Object.keys(errors).some(
      (key) => key !== "segmentLabels" && errors[key as keyof EventFormErrors] !== undefined,
    ) || Object.keys(errors.segmentLabels).length > 0
  );
}

/** Rows with a name, each with a stored key that no other row shares. */
export function cleanSegments(rows: readonly EventFormSegment[]): OnsiteEventSegmentOption[] {
  const used = new Set(rows.map((row) => row.value.trim()).filter(Boolean));
  const out: OnsiteEventSegmentOption[] = [];
  for (const row of rows) {
    const label = row.label.trim();
    if (!label) continue;
    let value = row.value.trim();
    if (!value) {
      const base = segmentKeyFromLabel(label) || "option";
      value = base;
      for (let n = 2; used.has(value); n += 1) value = `${base}_${n}`;
      used.add(value);
    }
    const helper = row.helper.trim();
    out.push({ value, label, ...(helper ? { helper } : {}) });
  }
  return out;
}

const orNull = (value: string): string | null => (value.trim() === "" ? null : value.trim());

/** The body the create and update actions take. */
export function eventFormPayload(values: EventFormValues) {
  return {
    slug: values.slug.trim(),
    title: values.title.trim(),
    status: values.status,
    segmentOptions: cleanSegments(values.segments),
    saleId: values.saleId,
    micrositeUrl: orNull(values.micrositeUrl),
    venue: orNull(values.venue),
    opsEmail: orNull(values.opsEmail),
    dressCode: orNull(values.dressCode),
    arrivalNote: orNull(values.arrivalNote),
    startsAt: values.startsAt,
    rsvpCloseAt: values.rsvpCloseAt,
  };
}
