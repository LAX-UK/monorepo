import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import type {
  OnsiteEventListItem,
  OnsiteEventRsvpAdminRow,
  OnsiteEventSegmentOption,
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

export async function getAdminOnsiteEvents(): Promise<OnsiteEventListItem[]> {
  const res = await authedServerFetch("/admin/onsite-events", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load onsite events: ${res.status}`);
  const body = (await res.json()) as { data?: unknown[] };
  return (body.data ?? [])
    .map(parseListItem)
    .filter((row): row is OnsiteEventListItem => row != null);
}

export async function getAdminOnsiteEventRsvps(slug: string): Promise<OnsiteEventRsvpAdminRow[]> {
  const res = await authedServerFetch(`/admin/onsite-events/${encodeURIComponent(slug)}/rsvps`, {
    cache: "no-store",
  });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Failed to load onsite event RSVPs: ${res.status}`);
  const body = (await res.json()) as { data?: unknown[] };
  return (body.data ?? [])
    .map(parseAdminRow)
    .filter((row): row is OnsiteEventRsvpAdminRow => row != null);
}

export async function getAdminOnsiteEventDetail(slug: string): Promise<{
  title: string;
  segmentOptions: OnsiteEventSegmentOption[];
  micrositeUrl: string | null;
} | null> {
  const events = await getAdminOnsiteEvents();
  const event = events.find((item) => item.slug === slug);
  if (!event) return null;

  const res = await authedServerFetch(`/events/${encodeURIComponent(slug)}/config`, {
    cache: "no-store",
  });
  if (!res.ok) {
    return { title: event.title, segmentOptions: [], micrositeUrl: null };
  }
  const body = (await res.json()) as { data?: Record<string, unknown> };
  return {
    title: typeof body.data?.title === "string" ? body.data.title : event.title,
    segmentOptions: parseSegmentOptions(body.data?.segmentOptions),
    micrositeUrl: typeof body.data?.micrositeUrl === "string" ? body.data.micrositeUrl : null,
  };
}
