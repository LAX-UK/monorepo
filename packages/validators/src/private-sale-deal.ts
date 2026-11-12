import {
  LOCK_LINK_TARGETS,
  LOCK_REASONS,
  WHERE_IT_IS_KEYS,
} from "@auction/artwork-register-contracts";
import { DEAL_VIEWS } from "@auction/domain";
import { PRIVATE_SALE_ARTWORK_UNLINKED_REASONS } from "@auction/types";
import { z } from "zod";
import { enquiryRefParamSchema } from "./marketing-enquiry.js";

/** The reference staff and clients quote: PS-0012. */
export const privateSaleReferenceSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^PS-\d{4,9}$/, "Use a reference like PS-0012");

export const privateSaleRefParamSchema = z.object({ ref: privateSaleReferenceSchema });

/** The moves staff may make on a deal from the record. `clear` re-checks the parties. */
export const STAFF_DEAL_ACTIONS = [
  "open_offer",
  "agree",
  "clear",
  "issue_invoice",
  "release",
  "cancel",
  "refund",
  "record_bank_transfer",
  "record_bank_refund",
] as const;
export type StaffDealAction = (typeof STAFF_DEAL_ACTIONS)[number];

export const privateSaleActionParamSchema = z.object({
  ref: privateSaleReferenceSchema,
  action: z.enum(STAFF_DEAL_ACTIONS),
});

export const adminDealListQuerySchema = z.object({
  view: z.enum(DEAL_VIEWS).default("active"),
  cursor: z.string().trim().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type AdminDealListQuery = z.infer<typeof adminDealListQuerySchema>;

/** The terms staff may change. Which of them, and when, is decided by the deal's stage and the person's role. */
export const adminDealTermsSchema = z
  .object({
    priceMinor: z.number().int().min(1).max(1_000_000_000_00).nullable().optional(),
    buyerFeeBps: z.number().int().min(0).max(10_000).optional(),
    sellerCommissionBps: z.number().int().min(0).max(10_000).nullable().optional(),
    costsMinor: z.number().int().min(0).max(1_000_000_000_00).optional(),
    vatTreatment: z
      .string()
      .trim()
      .regex(/^[a-z0-9_]+$/)
      .max(60)
      .nullable()
      .optional(),
    partiesDisclosed: z.boolean().optional(),
    offerExpiresAt: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .strict();
export type AdminDealTerms = z.infer<typeof adminDealTermsSchema>;

/** A change to a deal's terms, made against the version the person was looking at. */
export const adminDealTermsPatchSchema = z.object({
  version: z.number().int().min(1),
  terms: adminDealTermsSchema.refine((terms) => Object.keys(terms).length > 0, {
    message: "Nothing to change",
  }),
});
export type AdminDealTermsPatch = z.infer<typeof adminDealTermsPatchSchema>;

/** Name the buyer: the person who acts for them and, for an organisation, which one. */
export const adminDealBuyerSchema = z.object({
  version: z.number().int().min(1),
  buyerUserId: z.string().trim().min(1).max(100),
  legalEntityId: z.string().uuid().optional(),
});
export type AdminDealBuyerInput = z.infer<typeof adminDealBuyerSchema>;

/**
 * A move on a deal. The reason is why a deal is cancelled, how the work was handed over on a
 * release, or the bank's reference when a transfer is recorded; the other moves ignore it. The
 * amount, in pence, is how much of the payment a refund returns (all that is left when absent) or
 * how much the transfer was for.
 */
export const adminDealActionSchema = z.object({
  /** The version the person was looking at. */
  version: z.number().int().min(1),
  reason: z.string().trim().min(1).max(1000).optional(),
  amountMinor: z.number().int().min(1).max(1_000_000_000_00).optional(),
});
export type AdminDealActionInput = z.infer<typeof adminDealActionSchema>;

/** The consignment reference staff quote: C-1042. */
const workReferenceSchema = z
  .string()
  .trim()
  .regex(/^C-?\d{1,15}$/i, "Use a reference like C-1042");

/** Why a deal has no register artwork: the seller's own work, or in Zoho and not linked yet. */
export const privateSaleArtworkUnlinkedReasonSchema = z.enum(PRIVATE_SALE_ARTWORK_UNLINKED_REASONS);

/**
 * Turn an enquiry into a deal. A sell enquiry names its own work; a buy enquiry names the work
 * the buyer is being offered, by its consignment reference (C-1042). Either way the deal says
 * what its artwork is: an original in the register, which is held for the deal from the moment it
 * opens, or the reason it is not there. Exactly one of the two: the shape is checked here and the rule by the conversion, which
 * answers `artwork_choice_required`.
 */
export const adminDealConvertSchema = z.object({
  workReference: workReferenceSchema.optional(),
  /** The artwork register entry for the work. */
  artworkRegisterId: z.string().uuid().optional(),
  /** Why the artwork is not in the register. */
  notInRegister: z.object({ reason: privateSaleArtworkUnlinkedReasonSchema }).strict().optional(),
});
export type AdminDealConvertInput = z.infer<typeof adminDealConvertSchema>;

/** The artwork search staff use to pick a deal's artwork. */
export const adminDealArtworkSearchQuerySchema = z.object({
  /** Title, artist or stock code. Empty lists the suggestions first. */
  q: z.string().trim().max(100).default(""),
  /** The enquiry the deal is being made from: its artist and title lead the suggestions. */
  enquiry: enquiryRefParamSchema.shape.ref.optional(),
  /** The consignment the deal is for: the artwork its earlier lot offered is preselected. */
  work: workReferenceSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type AdminDealArtworkSearchQuery = z.infer<typeof adminDealArtworkSearchQuerySchema>;

/** Why the register will not hold an artwork, in its own words and with the link that goes with it. */
export const dealArtworkLockSchema = z.object({
  reason: z.enum(LOCK_REASONS),
  message: z.string(),
  link: z.object({ label: z.string(), target: z.enum(LOCK_LINK_TARGETS) }).nullable(),
});
export type DealArtworkLock = z.infer<typeof dealArtworkLockSchema>;

/** One original in the picker: what staff need to recognise it, where it is, and whether it can be held. */
export const dealArtworkOptionSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  artist: z.string(),
  medium: z.string().nullable(),
  size: z.string().nullable(),
  stockCode: z.string(),
  /** Zoho's Status for the artwork, as the register holds it. */
  catalogueStatus: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),
  whereItIs: z.object({
    key: z.enum(WHERE_IT_IS_KEYS),
    chip: z.object({
      label: z.string(),
      tone: z.enum(["neutral", "info", "success", "warning"]),
      marker: z.enum(["hollow", "filled", "check"]),
    }),
  }),
  /** The register would hold it for a new deal now. When it would not, `lock` says why. */
  available: z.boolean(),
  lock: dealArtworkLockSchema.optional(),
  /** It matches the artist or title the enquiry described. */
  suggested: z.boolean(),
});
export type DealArtworkOption = z.infer<typeof dealArtworkOptionSchema>;

export const dealArtworkSearchResultSchema = z.object({
  /** Artworks that can be held come first, then the others with the reason. */
  items: z.array(dealArtworkOptionSchema),
  /** There are more matches than `items` holds: type more to narrow them. */
  hasMore: z.boolean(),
  /** The artwork the consignment's earlier lot offered, when it is linked to the register. */
  preselected: dealArtworkOptionSchema.nullable(),
});
export type DealArtworkSearchResult = z.infer<typeof dealArtworkSearchResultSchema>;
