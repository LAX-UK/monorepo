import { relativeFromIso } from "@/lib/admin/relative-time";
import { formatDateShort, formatDateTime, formatDateTimeShort } from "@/lib/ui/format";

export type AdminTableDateTimeMode = "deadline" | "timestamp" | "dateOnly";

export type AdminTableDateTimeUrgency = "none" | "soon" | "past";

export type AdminTableDateTimeDeadlineKind = "end" | "start";

export type AdminTableDateTimePresentation = {
  iso: string | null;
  primary: string;
  secondary: string | null;
  title: string;
  urgency: AdminTableDateTimeUrgency;
};

export type FormatAdminTableDateTimeOptions = {
  now?: Date;
  deadlineKind?: AdminTableDateTimeDeadlineKind;
};

const EMPTY: AdminTableDateTimePresentation = {
  iso: null,
  primary: "—",
  secondary: null,
  title: "—",
  urgency: "none",
};

function toValidDate(value: Date | string | number | null | undefined): Date | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatFutureCompact(diffMs: number): string {
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `In ${Math.max(1, mins)}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `In ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `In ${days}d`;
  return "";
}

function formatDeadlinePrimary(
  date: Date,
  now: Date,
  deadlineKind: AdminTableDateTimeDeadlineKind,
): string {
  const diffMs = date.getTime() - now.getTime();
  if (diffMs > 0) {
    const compact = formatFutureCompact(diffMs);
    if (compact) return compact;
    return formatDateShort(date);
  }

  const relative = relativeFromIso(date.toISOString(), now);
  const prefix = deadlineKind === "start" ? "Started" : "Ended";
  if (relative.includes("ago")) return `${prefix} ${relative}`;
  return `${prefix} ${formatDateShort(date)}`;
}

function resolveDeadlineUrgency(date: Date, now: Date): AdminTableDateTimeUrgency {
  const diffMs = date.getTime() - now.getTime();
  if (diffMs <= 0) return "past";
  if (diffMs < 24 * 60 * 60 * 1000) return "soon";
  return "none";
}

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

function formatTimestampPrimary(date: Date, now: Date): string {
  const diffMs = now.getTime() - date.getTime();
  if (diffMs >= 0 && diffMs < TWENTY_FOUR_HOURS_MS) {
    return relativeFromIso(date.toISOString(), now);
  }
  return formatDateTimeShort(date, now);
}

export function formatAdminTableDateTime(
  value: Date | string | number | null | undefined,
  mode: AdminTableDateTimeMode,
  options: FormatAdminTableDateTimeOptions = {},
): AdminTableDateTimePresentation {
  const date = toValidDate(value);
  if (!date) return EMPTY;

  const now = options.now ?? new Date();
  const iso = date.toISOString();
  const title = formatDateTime(date);
  const deadlineKind = options.deadlineKind ?? "end";

  if (mode === "dateOnly") {
    return {
      iso,
      primary: formatDateShort(date),
      secondary: null,
      title,
      urgency: "none",
    };
  }

  if (mode === "timestamp") {
    return {
      iso,
      primary: formatTimestampPrimary(date, now),
      secondary: null,
      title,
      urgency: "none",
    };
  }

  return {
    iso,
    primary: formatDeadlinePrimary(date, now, deadlineKind),
    secondary: formatDateTimeShort(date, now),
    title,
    urgency: resolveDeadlineUrgency(date, now),
  };
}

export type AdminDateStatExtras = {
  dateIso?: string;
  dateMode?: AdminTableDateTimeMode;
  dateLive?: boolean;
  deadlineKind?: AdminTableDateTimeDeadlineKind;
};

/** Optional DetailStatRow date fields when a value is present and valid. */
export function adminDateStatExtras(
  value: Date | string | number | null | undefined,
  mode: AdminTableDateTimeMode,
  options?: FormatAdminTableDateTimeOptions & { dateLive?: boolean },
): AdminDateStatExtras {
  const d = toValidDate(value);
  if (!d) return {};

  const extras: AdminDateStatExtras = {
    dateIso: d.toISOString(),
    dateMode: mode,
  };

  if (options?.dateLive !== undefined) {
    extras.dateLive = options.dateLive;
  }
  if (options?.deadlineKind !== undefined) {
    extras.deadlineKind = options.deadlineKind;
  }

  return extras;
}
