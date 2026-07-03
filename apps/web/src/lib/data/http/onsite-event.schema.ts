import { toObjectRecord } from "@/lib/data/http/object-guards";
import type {
  OnsiteEventAdminDetail,
  OnsiteEventListItem,
  OnsiteEventRsvpAdminRow,
  OnsiteEventSegmentOption,
  OnsiteEventStatus,
} from "@auction/types";
import { z } from "zod";

const EVENT_STATUSES = new Set<OnsiteEventStatus>(["draft", "published", "closed"]);

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

export const onsiteEventRsvpAdminRowSchema = z.custom<OnsiteEventRsvpAdminRow | null>((value) => {
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
}) as z.ZodType<OnsiteEventRsvpAdminRow | null>;

export const onsiteEventListItemSchema = z.custom<OnsiteEventListItem | null>((value) => {
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
    saleId: typeof row.saleId === "string" ? row.saleId : null,
  };
}) as z.ZodType<OnsiteEventListItem | null>;

export const onsiteEventAdminDetailSchema = z.custom<OnsiteEventAdminDetail | null>((value) => {
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
    opsEmail: typeof row.opsEmail === "string" ? row.opsEmail : null,
    checkInDryRun: row.checkInDryRun,
    rsvpCount: row.rsvpCount,
    checkedInCount: row.checkedInCount,
    saleId: typeof row.saleId === "string" ? row.saleId : null,
  };
}) as z.ZodType<OnsiteEventAdminDetail | null>;

export const nullableOnsiteEventAdminDetailSchema = onsiteEventAdminDetailSchema;

export const onsiteEventSlugSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform((row) => ({ slug: String(row.slug ?? "") })) as z.ZodType<{ slug: string }>;
