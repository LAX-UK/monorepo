import { z } from "zod";

/** An amount in pounds as a decimal string, up to two decimal places (exact, never a float). */
const poundsString = z
  .string()
  .trim()
  .regex(/^\d{1,12}(\.\d{1,2})?$/, "Enter an amount in pounds, like 240 or 240.50");

/** The acting account's bids, optionally on one sale (the per-sale view). */
export const accountBidsQuerySchema = z.object({ saleId: z.string().uuid().optional() });

/** Lots a card grid asks the bidder's standing on at once. */
export const LOT_STATES_MAX_LOTS = 60;

/** `?lotIds=a,b,c`: up to 60 lot ids, repeats ignored. */
export const lotStatesQuerySchema = z.object({
  lotIds: z
    .string()
    .transform((raw) => [
      ...new Set(
        raw
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean),
      ),
    ])
    .pipe(z.array(z.string().uuid()).min(1).max(LOT_STATES_MAX_LOTS)),
});
export type LotStatesQuery = z.infer<typeof lotStatesQuerySchema>;

/** A page of the acting account's purchases. */
export const accountPurchasesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type AccountPurchasesQuery = z.infer<typeof accountPurchasesQuerySchema>;

export const purchaseLotIdParamSchema = z.object({ lotId: z.string().uuid() });

/** The invoices picked for one payment; the domain rule decides which can be paid together. */
export const paySeveralBodySchema = z
  .object({ lotIds: z.array(z.string().uuid()).min(1).max(20) })
  .strict();
export type PaySeveralBody = z.infer<typeof paySeveralBodySchema>;

/** Ask for a courier quote: where the work should go, as the buyer writes it. */
export const requestDeliveryQuoteSchema = z
  .object({ destination: z.string().trim().min(5).max(500) })
  .strict();
export type RequestDeliveryQuoteBody = z.infer<typeof requestDeliveryQuoteSchema>;

/** The saleroom team's price for a requested courier quote, with what it covers. */
export const staffDeliveryQuoteSchema = z
  .object({
    amount: poundsString.refine((v) => Number(v) > 0, "Enter an amount above zero"),
    note: z.string().trim().max(500).nullable().optional(),
  })
  .strict();
export type StaffDeliveryQuoteBody = z.infer<typeof staffDeliveryQuoteSchema>;

/**
 * What to hear about for an artist one follows: words in the medium and a price range. Every
 * field is optional; `null` clears it. Whether the range is ordered is a domain rule.
 */
export const artistAlertCriteriaSchema = z
  .object({
    medium: z.string().trim().max(80).nullable(),
    priceMin: poundsString.nullable(),
    priceMax: poundsString.nullable(),
  })
  .strict()
  .transform((v) => ({ ...v, medium: v.medium ? v.medium : null }));
export type ArtistAlertCriteriaBody = z.infer<typeof artistAlertCriteriaSchema>;
