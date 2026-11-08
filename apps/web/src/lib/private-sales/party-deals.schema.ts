import { PRIVATE_SALE_DEAL_STAGES } from "@auction/types";
import { z } from "zod";

/** What the client private sale routes answer with. Browser-safe: no server-only imports. */
const stage = z.enum(PRIVATE_SALE_DEAL_STAGES);
const role = z.enum(["seller", "buyer"]);
const need = z.enum(["accept_terms", "verify_identity", "proof_of_funds", "pay"]);

export const partyDealRowSchema = z.object({
  reference: z.string(),
  role,
  stage,
  workTitle: z.string(),
  workReference: z.string(),
  priceMinor: z.number().nullable(),
  totalDueMinor: z.number().nullable(),
  netToSellerMinor: z.number().nullable(),
  paymentDueAt: z.string().nullable(),
  needs: need.nullable(),
  updatedAt: z.string(),
});
export type PartyDealRow = z.infer<typeof partyDealRowSchema>;
export type PartyDealNeed = z.infer<typeof need>;

export const partyDealDetailSchema = z.object({
  view: z.object({
    audience: role,
    reference: z.string(),
    stage,
    priceState: z.enum(["under_discussion", "agreed"]),
    counterparty: z.union([
      z.object({ disclosed: z.literal(false), label: z.literal("LAX") }),
      z.object({ disclosed: z.literal(true), label: z.string() }),
    ]),
    buyerMoney: z
      .object({ priceMinor: z.number(), buyerFeeMinor: z.number(), totalDueMinor: z.number() })
      .nullable(),
    sellerMoney: z
      .object({
        priceMinor: z.number(),
        sellerCommissionMinor: z.number().nullable(),
        costsMinor: z.number(),
        netToSellerMinor: z.number().nullable(),
      })
      .nullable(),
    paymentDueAt: z.string().nullable(),
    collectionDueAt: z.string().nullable(),
  }),
  work: z.object({ title: z.string(), reference: z.string() }),
  needs: need.nullable(),
  termsToAccept: z.string().nullable(),
  payable: z.boolean(),
});
export type PartyDealDetail = z.infer<typeof partyDealDetailSchema>;

export const checkoutSchema = z.object({ checkoutUrl: z.string().url(), amountMinor: z.number() });
