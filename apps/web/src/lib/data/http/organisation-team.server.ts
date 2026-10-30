import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { X_LEGAL_ENTITY_ID_HEADER } from "@/lib/legal-entity/client-acting-context";
import { ACCESS_REQUEST_STATUSES, ACTIVITY_GROUPS } from "@auction/domain";
import { type OrganisationBiddingLimitsView, legalEntityMemberRoles } from "@auction/types";
import { z } from "zod";
import {
  type AccessRequestView,
  type ActivityPageView,
  type ActivityQuery,
  type InvoiceDetailsView,
  activityQueryString,
} from "./organisation-team.types";

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

const invoiceDetailsSchema = z.object({
  billingEmail: z.string().nullable(),
  address: z
    .object({
      line1: z.string(),
      line2: z.string().nullable(),
      city: z.string(),
      region: z.string().nullable(),
      postalCode: z.string(),
      country: z.string(),
    })
    .nullable(),
  poReference: z.string().nullable(),
  updatedAt: z.string().nullable(),
  canEdit: z.boolean(),
}) satisfies z.ZodType<InvoiceDetailsView>;

const detailValue = z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.string())]);

const activityPageSchema = z.object({
  entries: z.array(
    z.object({
      id: z.number(),
      kind: z.string(),
      group: z.enum(ACTIVITY_GROUPS),
      occurredAt: z.string(),
      actorUserId: z.string().nullable(),
      subjectUserId: z.string().nullable(),
      detail: z.record(z.string(), detailValue),
      actorName: z.string(),
      subjectName: z.string().nullable(),
    }),
  ),
  nextBefore: z.number().nullable(),
}) satisfies z.ZodType<ActivityPageView>;

const accessRequestSchema = z.object({
  id: z.string(),
  requesterUserId: z.string(),
  requesterName: z.string().nullable(),
  requestedRole: z.enum(legalEntityMemberRoles).nullable(),
  requestedCapability: z.string().nullable(),
  reason: z.string(),
  status: z.enum(ACCESS_REQUEST_STATUSES),
  grantedRole: z.enum(legalEntityMemberRoles).nullable(),
  decidedAt: z.string().nullable(),
  decisionNote: z.string().nullable(),
  createdAt: z.string(),
}) satisfies z.ZodType<AccessRequestView>;

async function readData<T>(res: Response, schema: z.ZodType<T>): Promise<T | null> {
  if (!res.ok) return null;
  const body: unknown = await res.json().catch(() => null);
  if (!body || typeof body !== "object" || !("data" in body)) return null;
  const parsed = schema.safeParse(body.data);
  return parsed.success ? parsed.data : null;
}

function get(path: string, legalEntityId: string): Promise<Response> {
  return authedServerFetch(path, {
    headers: { [X_LEGAL_ENTITY_ID_HEADER]: legalEntityId },
    cache: "no-store",
  });
}

/** The organisation's bidding limits and what is in use; `null` when they cannot be read. */
export async function getServerBiddingLimits(
  legalEntityId: string,
): Promise<OrganisationBiddingLimitsView | null> {
  return readData(await get("/legal-entities/bidding-limits", legalEntityId), biddingLimitsSchema);
}

/** The details printed on the organisation's invoices; `null` when they cannot be read. */
export async function getServerInvoiceDetails(
  legalEntityId: string,
): Promise<InvoiceDetailsView | null> {
  return readData(await get("/legal-entities/invoice-details", legalEntityId), invoiceDetailsSchema);
}

/** One page of the organisation's Activity, newest first; `null` when it cannot be read. */
export async function getServerOrganisationActivity(
  legalEntityId: string,
  query: ActivityQuery,
): Promise<ActivityPageView | null> {
  const qs = activityQueryString(query);
  return readData(
    await get(`/legal-entities/activity${qs ? `?${qs}` : ""}`, legalEntityId),
    activityPageSchema,
  );
}

/**
 * Access requests: every one for owners and admins, the member's own for anyone else; `null` when
 * they cannot be read.
 */
export async function getServerAccessRequests(
  legalEntityId: string,
  status?: AccessRequestView["status"],
): Promise<AccessRequestView[] | null> {
  const qs = status ? `?status=${status}` : "";
  return readData(
    await get(`/legal-entities/access-requests${qs}`, legalEntityId),
    z.array(accessRequestSchema),
  );
}
