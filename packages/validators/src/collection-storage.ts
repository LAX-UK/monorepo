import {
  MAX_STORAGE_AMOUNT_PENCE,
  MAX_STORAGE_EXTENSION_DAYS,
  MAX_STORAGE_FREE_DAYS,
  type StorageCountMode,
} from "@auction/domain";
import { z } from "zod";

/**
 * Staff changing a place's storage terms and its charging switch (docs/design/storage-terms.md).
 * Checked at the API edge: money is whole pence from 0 to £500.00, never negative or fractional;
 * free days are a whole number from 0 to 90; every change carries a reason for the history. The
 * rule that a change starts from tomorrow needs the London day, so the service checks it.
 */

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar day written `YYYY-MM-DD`. */
const londonDay = z
  .string()
  .regex(DAY)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "Enter a real date");

const COUNT_MODES = ["calendar", "working"] as const satisfies readonly StorageCountMode[];

const pence = z.number().int().min(0).max(MAX_STORAGE_AMOUNT_PENCE);

/** Why staff made the change; shown in the History table. */
export const storageReasonSchema = z.string().trim().min(1).max(500);

export const storageTermsBodySchema = z
  .object({
    effectiveFrom: londonDay,
    reason: storageReasonSchema,
    freeDays: z.number().int().min(0).max(MAX_STORAGE_FREE_DAYS),
    countMode: z.enum(COUNT_MODES),
    standardDailyPence: pence,
    /**
     * `null` turns the large band off: large works pay the standard rate. A band that is on
     * charges something; £0.00 would tell buyers "or £0.00 for works over 150 cm".
     */
    largeDailyPence: pence.min(1).nullable(),
    handlingFeePence: pence,
  })
  .strict();
export type StorageTermsBody = z.infer<typeof storageTermsBodySchema>;

export const cancelStorageTermsBodySchema = z.object({ reason: storageReasonSchema }).strict();
export type CancelStorageTermsBody = z.infer<typeof cancelStorageTermsBodySchema>;

export const setStorageChargingBodySchema = z
  .object({ raiseInvoices: z.boolean(), reason: storageReasonSchema })
  .strict();
export type SetStorageChargingBody = z.infer<typeof setStorageChargingBodySchema>;

export const storageTermsParamSchema = z.object({
  venueId: z.string().uuid(),
  termsId: z.string().uuid(),
});

/** Fulfilment adds free storage days to one lot, with the reason the buyer's history keeps. */
export const extendLotStorageBodySchema = z
  .object({
    days: z.number().int().min(1).max(MAX_STORAGE_EXTENSION_DAYS),
    reason: storageReasonSchema,
  })
  .strict();
export type ExtendLotStorageBody = z.infer<typeof extendLotStorageBodySchema>;

/** Finance waives one lot's storage charges, with the reason. */
export const waiveLotStorageBodySchema = z.object({ reason: storageReasonSchema }).strict();
export type WaiveLotStorageBody = z.infer<typeof waiveLotStorageBodySchema>;

export const storageLotParamSchema = z.object({
  venueId: z.string().uuid(),
  lotId: z.string().uuid(),
});
