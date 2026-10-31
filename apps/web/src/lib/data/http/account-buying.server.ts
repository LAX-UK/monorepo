import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { zCoerceDate } from "@/lib/data/http/schema-coerce";
import { X_LEGAL_ENTITY_ID_HEADER } from "@/lib/legal-entity/client-acting-context";
import { type CollectionBookingOffer, DELIVERY_QUOTE_STATUSES } from "@auction/domain";
import type { OrganisationBiddingLimitsView } from "@auction/types";
import { z } from "zod";
import type {
  AccountPurchaseFacts,
  AccountRegistrationView,
  PurchaseQuoteView,
} from "./account-buying.types";

const personSchema = z.object({ userId: z.string(), name: z.string().nullable() });

const registrationSchema = z.object({
  id: z.string(),
  saleId: z.string(),
  saleTitle: z.string(),
  saleStartsAt: zCoerceDate,
  saleEndsAt: zCoerceDate,
  status: z.enum(["pending", "approved", "rejected", "withdrawn"]),
  paddleNumber: z.number().nullable(),
  bidLimit: z.string().nullable(),
  requestedAt: zCoerceDate,
  decidedAt: zCoerceDate.nullable(),
  registeredBy: personSchema,
}) satisfies z.ZodType<AccountRegistrationView, z.ZodTypeDef, unknown>;

const quoteSchema = z.object({
  id: z.string(),
  status: z.enum(DELIVERY_QUOTE_STATUSES),
  destination: z.string(),
  amount: z.string().nullable(),
  currency: z.string(),
  quoteNote: z.string().nullable(),
  requestedAt: zCoerceDate,
  quotedAt: zCoerceDate.nullable(),
  actions: z.array(z.enum(["request", "quote", "accept", "withdraw"])),
}) satisfies z.ZodType<PurchaseQuoteView, z.ZodTypeDef, unknown>;

const purchaseSchema = z.object({
  lotId: z.string(),
  wonBy: personSchema.nullable(),
  paymentRole: z.enum(["payer", "informed", "none"]),
  invoice: z.object({
    status: z.enum([
      "not_invoiced",
      "due",
      "overdue",
      "processing",
      "paid",
      "refunded",
      "cancelled",
    ]),
    dueAt: zCoerceDate.nullable(),
    paymentId: z.string().nullable(),
    totalDue: z.string().nullable(),
  }),
  delivery: z.object({
    stage: z.enum([
      "awaiting_payment",
      "choose",
      "quote_requested",
      "quote_ready",
      "booked",
      "preparing",
      "ready_to_collect",
      "in_transit",
      "delivered",
      "collected",
      "cancelled",
    ]),
    method: z.enum(["collection", "shipping"]).nullable(),
    carrier: z.string().nullable(),
    trackingNumber: z.string().nullable(),
    collectedBy: z.string().nullable(),
    collectedAt: zCoerceDate.nullable(),
    quote: quoteSchema.nullable(),
  }),
}) satisfies z.ZodType<AccountPurchaseFacts, z.ZodTypeDef, unknown>;

const collectionOfferSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("self_serve"), hours: z.string(), place: z.string().nullable() }),
  z.object({
    kind: z.literal("email"),
    email: z.string(),
    hours: z.string().nullable(),
    place: z.string().nullable(),
  }),
]) satisfies z.ZodType<CollectionBookingOffer>;

const usageSchema = z.object({
  limit: z.string().nullable(),
  exposure: z.string(),
  available: z.string().nullable(),
});

const biddingLimitsSchema = z.object({
  canManage: z.boolean(),
  organisation: usageSchema.extend({ updatedAt: z.string().nullable() }),
  authorisations: z.array(
    z.object({
      authorisationId: z.string(),
      userId: z.string(),
      userName: z.string(),
      saleId: z.string().nullable(),
      saleTitle: z.string().nullable(),
      bidLimit: z.string().nullable(),
      total: usageSchema,
    }),
  ),
}) satisfies z.ZodType<OrganisationBiddingLimitsView>;

/**
 * Sends the request for one organisation. These reads need the account named: the API has no
 * personal-account fallback for them.
 */
function forAccount(accountId: string): RequestInit {
  return { cache: "no-store", headers: { [X_LEGAL_ENTITY_ID_HEADER]: accountId } };
}

async function readData<T>(res: Response, schema: z.ZodType<T, z.ZodTypeDef, unknown>) {
  if (!res.ok) return null;
  const body: unknown = await res.json().catch(() => null);
  if (!body || typeof body !== "object" || !("data" in body)) return null;
  const parsed = schema.safeParse(body.data);
  return parsed.success ? parsed.data : null;
}

/** The sales the account is registered for, as far as the member follows them; `null` on failure. */
export async function getServerAccountRegistrations(
  accountId: string,
): Promise<AccountRegistrationView[] | null> {
  const res = await authedServerFetch("/legal-entities/registrations", forAccount(accountId));
  return readData(res, z.array(registrationSchema));
}

/** The most purchases one page of the list reads; the API pages at 100. */
const PURCHASE_PAGE = 100;
/** A ceiling on pages, so a runaway answer cannot loop. */
const MAX_PURCHASE_PAGES = 10;

/**
 * The invoice and delivery state of each purchase, as far as the member follows them; `null` when
 * the list could not be read.
 */
export async function getServerAccountPurchaseFacts(
  accountId: string,
): Promise<AccountPurchaseFacts[] | null> {
  const pageSchema = z.object({
    items: z.array(purchaseSchema),
    nextOffset: z.number().nullable(),
  });
  const items: AccountPurchaseFacts[] = [];
  let offset: number | null = 0;
  for (let page = 0; offset !== null && page < MAX_PURCHASE_PAGES; page += 1) {
    const res = await authedServerFetch(
      `/legal-entities/purchases?limit=${PURCHASE_PAGE}&offset=${offset}`,
      forAccount(accountId),
    );
    const data = await readData(res, pageSchema);
    if (!data) return null;
    items.push(...data.items);
    offset = data.nextOffset;
  }
  return items;
}

/** How a work is collected from the saleroom; `null` when it cannot be read. */
export async function getServerCollectionOffer(
  accountId: string,
  lotId: string,
): Promise<CollectionBookingOffer | null> {
  const res = await authedServerFetch(
    `/legal-entities/purchases/${encodeURIComponent(lotId)}/collection`,
    forAccount(accountId),
  );
  return readData(res, collectionOfferSchema);
}

/** The organisation's bidding limits and what is used under them; `null` on failure. */
export async function getServerBiddingLimits(
  accountId: string,
): Promise<OrganisationBiddingLimitsView | null> {
  const res = await authedServerFetch("/legal-entities/bidding-limits", forAccount(accountId));
  return readData(res, biddingLimitsSchema);
}
