/**
 * Zod schemas for marketing attribution API bodies. Kept apart from `marketing-attribution.ts`
 * so the helpers browsers load do not bring the schema library with them.
 */
import { MARKETING_ATTRIBUTION_VERSION } from "@auction/types";
import { z } from "zod";

const touchField = z.string().trim().min(1).max(256);

export const marketingAttributionTouchSchema = z.object({
  capturedAt: z.string().datetime({ offset: true }),
  landingPath: z.string().trim().min(1).max(2048),
  utmSource: touchField.optional(),
  utmMedium: touchField.optional(),
  utmCampaign: touchField.optional(),
  utmId: touchField.optional(),
  utmTerm: touchField.optional(),
  utmContent: touchField.optional(),
  utmSourcePlatform: touchField.optional(),
  utmCreativeFormat: touchField.optional(),
  utmMarketingTactic: touchField.optional(),
  gclid: touchField.optional(),
  gbraid: touchField.optional(),
  wbraid: touchField.optional(),
  dclid: touchField.optional(),
  fbclid: touchField.optional(),
  msclkid: touchField.optional(),
});

export const marketingAttributionSnapshotSchema = z
  .object({
    version: z.literal(MARKETING_ATTRIBUTION_VERSION),
    firstTouch: marketingAttributionTouchSchema.optional(),
    lastTouch: marketingAttributionTouchSchema.optional(),
  })
  .refine((snapshot) => snapshot.firstTouch !== undefined || snapshot.lastTouch !== undefined, {
    message: "At least one attribution touch is required",
  });

export const marketingAttributionPutBodySchema = z.object({
  snapshot: marketingAttributionSnapshotSchema,
});

export type MarketingAttributionPutBody = z.infer<typeof marketingAttributionPutBodySchema>;
