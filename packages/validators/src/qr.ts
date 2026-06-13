import { z } from "zod";

export const qrCodeEntityTypes = ["sale", "lot"] as const;
export const qrCodeStatuses = ["active", "disabled"] as const;

export const qrShortCodeSchema = z
  .string()
  .min(6)
  .max(12)
  .regex(/^[0-9A-Za-z]+$/, "Short code must be Base62");

export const qrShortCodeParamSchema = z.object({
  shortCode: qrShortCodeSchema,
});

export const adminQrCodeIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const adminQrCodeEntityQuerySchema = z.object({
  entityType: z.enum(qrCodeEntityTypes),
  entityId: z.string().uuid(),
});

export const adminQrCodeCreateSchema = z.object({
  entityType: z.enum(qrCodeEntityTypes),
  entityId: z.string().uuid(),
  campaign: z.string().trim().max(120).optional(),
  placement: z.string().trim().max(120).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

export const adminQrCodeRegenerateSchema = z.object({
  entityType: z.enum(qrCodeEntityTypes),
  entityId: z.string().uuid(),
});

export const adminQrCodeUpdateSchema = z.object({
  campaign: z.string().trim().max(120).nullable().optional(),
  placement: z.string().trim().max(120).nullable().optional(),
  status: z.enum(qrCodeStatuses).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

export const qrCodeAnalyticsRanges = ["24h", "7d", "30d", "90d", "all"] as const;
export type QrCodeAnalyticsRange = (typeof qrCodeAnalyticsRanges)[number];
export type QrCodeAnalyticsGranularity = "hour" | "day";
export type QrCodeAnalyticsSource = "raw" | "daily";

export const adminQrCodeAnalyticsQuerySchema = z.object({
  range: z.enum(qrCodeAnalyticsRanges).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  /** @deprecated Prefer `range` or `from`/`to`. Kept for backward compatibility. */
  days: z.coerce.number().int().min(1).max(365).optional(),
});

export type AdminQrCodeAnalyticsQuery = z.infer<typeof adminQrCodeAnalyticsQuerySchema>;

export type ResolvedQrCodeAnalyticsQuery = {
  from: Date | null;
  to: Date;
  granularity: QrCodeAnalyticsGranularity;
  source: QrCodeAnalyticsSource;
  rangeKey: string;
};

const MS_PER_HOUR = 3_600_000;

function utcDayStart(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function daysAgoUtcMidnight(days: number, anchor: Date): Date {
  const start = utcDayStart(anchor);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return start;
}

export function resolveQrCodeAnalyticsQuery(
  input: AdminQrCodeAnalyticsQuery,
  now: Date = new Date(),
): ResolvedQrCodeAnalyticsQuery {
  if (input.from && input.to) {
    const from = new Date(input.from);
    const to = new Date(input.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
      throw new Error("Invalid analytics date range");
    }
    const spanMs = to.getTime() - from.getTime();
    const useHourly = spanMs <= MS_PER_HOUR * 24;
    return {
      from,
      to,
      granularity: useHourly ? "hour" : "day",
      source: useHourly ? "raw" : "daily",
      rangeKey: "custom",
    };
  }

  if (input.range === "24h") {
    return {
      from: new Date(now.getTime() - MS_PER_HOUR * 24),
      to: now,
      granularity: "hour",
      source: "raw",
      rangeKey: "24h",
    };
  }

  if (input.range === "all") {
    return {
      from: null,
      to: now,
      granularity: "day",
      source: "daily",
      rangeKey: "all",
    };
  }

  const presetDays =
    input.range === "7d"
      ? 7
      : input.range === "90d"
        ? 90
        : input.range === "30d"
          ? 30
          : (input.days ?? 30);

  return {
    from: daysAgoUtcMidnight(presetDays, now),
    to: now,
    granularity: "day",
    source: "daily",
    rangeKey: input.range ?? `${presetDays}d`,
  };
}

export type AdminQrCodeCreateInput = z.infer<typeof adminQrCodeCreateSchema>;
export type AdminQrCodeRegenerateInput = z.infer<typeof adminQrCodeRegenerateSchema>;
export type AdminQrCodeUpdateInput = z.infer<typeof adminQrCodeUpdateSchema>;
export type AdminQrCodeEntityQuery = z.infer<typeof adminQrCodeEntityQuerySchema>;
