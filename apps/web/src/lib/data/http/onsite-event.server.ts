import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import type {
  OnsiteEventAdminDetail,
  OnsiteEventListItem,
  OnsiteEventRsvpAdminRow,
  OnsiteEventSegmentOption,
  OnsiteEventStatus,
} from "@auction/types";

function parseAdminRow(value: unknown): OnsiteEventRsvpAdminRow | null {
  if (typeof value !== "object" || value === null) return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== "string" ||
    typeof row.name !== "string" ||
    typeof row.email !== "string" ||
    typeof row.attendanceSegment !== "string" ||
    typeof row.plusOne !== "number" ||
    typeof row.createdAt !== "string" ||
    typeof row.updatedAt !== "string"
  ) {
    return null;
  }
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    attendanceSegment: row.attendanceSegment,
    plusOne: row.plusOne,
    plusOneGuestName: typeof row.plusOneGuestName === "string" ? row.plusOneGuestName : null,
    notes: typeof row.notes === "string" ? row.notes : null,
    checkedInAt: typeof row.checkedInAt === "string" ? row.checkedInAt : null,
    checkInPartyCount: typeof row.checkInPartyCount === "number" ? row.checkInPartyCount : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function parseListItem(value: unknown): OnsiteEventListItem | null {
  if (typeof value !== "object" || value === null) return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.slug !== "string" ||
    typeof row.title !== "string" ||
    typeof row.status !== "string" ||
    typeof row.rsvpCount !== "number"
  ) {
    return null;
  }
  return {
    slug: row.slug,
    title: row.title,
    startsAt: typeof row.startsAt === "string" ? row.startsAt : null,
    rsvpCloseAt: typeof row.rsvpCloseAt === "string" ? row.rsvpCloseAt : null,
    status: row.status as OnsiteEventListItem["status"],
    rsvpCount: row.rsvpCount,
  };
}

function parseSegmentOptions(value: unknown): OnsiteEventSegmentOption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item !== "object" || item === null) return [];
    const row = item as Record<string, unknown>;
    if (typeof row.value !== "string" || typeof row.label !== "string") return [];
    return [
      {
        value: row.value,
        label: row.label,
        ...(typeof row.helper === "string" ? { helper: row.helper } : {}),
      },
    ];
  });
}

const EVENT_STATUSES = new Set<OnsiteEventStatus>(["draft", "published", "closed"]);

function parseAdminDetail(value: unknown): OnsiteEventAdminDetail | null {
  if (typeof value !== "object" || value === null) return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.slug !== "string" ||
    typeof row.title !== "string" ||
    typeof row.status !== "string" ||
    typeof row.checkInDryRun !== "boolean" ||
    typeof row.rsvpCount !== "number" ||
    typeof row.checkedInCount !== "number"
  ) {
    return null;
  }
  if (!EVENT_STATUSES.has(row.status as OnsiteEventStatus)) return null;

  return {
    slug: row.slug,
    title: row.title,
    status: row.status as OnsiteEventStatus,
    startsAt: typeof row.startsAt === "string" ? row.startsAt : null,
    rsvpCloseAt: typeof row.rsvpCloseAt === "string" ? row.rsvpCloseAt : null,
    segmentOptions: parseSegmentOptions(row.segmentOptions),
    micrositeUrl: typeof row.micrositeUrl === "string" ? row.micrositeUrl : null,
    venue: typeof row.venue === "string" ? row.venue : null,
    dressCode: typeof row.dressCode === "string" ? row.dressCode : null,
    arrivalNote: typeof row.arrivalNote === "string" ? row.arrivalNote : null,
    checkInDryRun: row.checkInDryRun,
    rsvpCount: row.rsvpCount,
    checkedInCount: row.checkedInCount,
  };
}

export async function getAdminOnsiteEvents(): Promise<OnsiteEventListItem[]> {
  const res = await authedServerFetch("/admin/event-rsvps", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load event RSVPs: ${res.status}`);
  const body = (await res.json()) as { data?: unknown[] };
  return (body.data ?? [])
    .map(parseListItem)
    .filter((row): row is OnsiteEventListItem => row != null);
}

export async function getAdminOnsiteEventDetail(
  slug: string,
): Promise<OnsiteEventAdminDetail | null> {
  const res = await authedServerFetch(`/admin/event-rsvps/${encodeURIComponent(slug)}`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load onsite event: ${res.status}`);
  const body = (await res.json()) as { data?: unknown };
  return parseAdminDetail(body.data);
}

export async function getAdminOnsiteEventRsvps(slug: string): Promise<OnsiteEventRsvpAdminRow[]> {
  const res = await authedServerFetch(`/admin/event-rsvps/${encodeURIComponent(slug)}/rsvps`, {
    cache: "no-store",
  });
  if (res.status === 404) {
    throw new Error("Onsite event not found");
  }
  if (!res.ok) throw new Error(`Failed to load onsite event RSVPs: ${res.status}`);
  const body = (await res.json()) as { data?: unknown[] };
  return (body.data ?? [])
    .map(parseAdminRow)
    .filter((row): row is OnsiteEventRsvpAdminRow => row != null);
}
