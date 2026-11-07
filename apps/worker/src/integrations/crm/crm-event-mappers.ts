import { type DealType, clientLabel, formatDealName } from "@auction/artwork-register-contracts";
import { parseDomainEventPayload } from "@auction/types";
import type { CrmDealNamingFacts } from "./crm-deal-naming-reader.js";
import {
  CRM_FIELD,
  CRM_LEAD_SOURCE_BID_ENQUIRY,
  CRM_LEAD_SOURCE_BID_PRIVATE_SALE_ENQUIRY,
  CRM_LEAD_SOURCE_SHOP_ENQUIRY,
  CRM_LEAD_SOURCE_SHOP_GUEST,
  CRM_LEAD_SOURCE_SIGN_UP,
  lotWonDealEntityId,
  lotWonDealKey,
  shopOrderDealEntityId,
  shopOrderDealKey,
} from "./crm-field-constants.js";
import type { CrmFieldValue } from "./crm-gateway.js";
import {
  consentFields,
  enquiryTypeFor,
  interestFields,
  newLeadFields,
  noticeConfirmedFields,
  websiteLeadFields,
} from "./crm-lead-fields.js";
import type { CrmEnquiryType } from "./crm-lead-fields.js";
import { splitDisplayName } from "./crm-name-fields.js";
import type { CrmEnquiryRecord } from "./crm-readers.js";
import type { CrmShopEnquiryRecord } from "./crm-shop-enquiry-reader.js";

export type DomainEventRowForCrm = {
  id: number;
  eventType: string;
  aggregateId: string;
  payload: unknown;
  schemaVersion?: number;
};

export type CrmMappedIntent =
  | { kind: "skip"; reason: string }
  | {
      kind: "person_upsert";
      subjectId: string;
      email: string;
      fields: Record<string, CrmFieldValue>;
      /** Written only when the lead is created here; an admin's later edits are never overwritten. */
      createOnlyFields: Record<string, CrmFieldValue>;
    }
  | { kind: "person_patch"; subjectId: string; fields: Record<string, CrmFieldValue> }
  | {
      kind: "deal_upsert";
      dealEntityId: string;
      dealKey: string;
      subjectId: string;
      fields: Record<string, CrmFieldValue>;
      /**
       * A purchase: the deal waits in the ledger until an admin has converted the buyer's lead,
       * and is never created without a Contact.
       */
      purchase?: CrmPurchase;
    }
  | { kind: "deal_stage"; dealEntityId: string; stage: string }
  | {
      kind: "purchase_paid";
      dealEntityId: string;
      stage: string;
      amount: number;
      paidAt: string;
    }
  | { kind: "merge_subjects"; subjectId: string; retiredSubjectId: string }
  | { kind: "deletion_requested"; subjectId: string }
  | { kind: "deletion_cancelled"; subjectId: string }
  | { kind: "erase_subject"; subjectId: string }
  | {
      kind: "shop_artwork_product_upsert";
      aggregateId: string;
      importKey: string;
      slug: string;
      eligibleForEditionAllocation: boolean;
    };

/** What a paying buyer bought, for the note an admin reads before converting the lead. */
export type CrmPurchase = {
  product: "LAX Bid" | "LAX Shop";
  /** True once the money is in: a Shop order is paid when it is recorded, a lot when captured. */
  paid: boolean;
};

export type CrmMapperContext = {
  /** Lead Status a new lead starts with. */
  leadStatusNew: string;
  auctionPipeline: string;
  dealStageLotWon: string;
  dealStagePaymentCaptured: string;
  dealStagePaymentRefunded: string;
  dealStageShopPaid: string;
  attribution?: Record<string, CrmFieldValue> | null;
  /** lax.art origin, for the link to the enquired work; no link is sent without it. */
  artPublicUrl?: string;
};

/** Values resolved outside the catalog payload (e.g. lot id for refunds). */
export type CrmMapperResolved = {
  paymentRefundLotId?: string;
  /** The enquiry a `marketing_enquiry.received` event refers to; null when it no longer exists. */
  enquiry?: CrmEnquiryRecord | null;
  /** The signed-in sender and the work a Shop original enquiry is about; null when gone. */
  shopEnquiry?: CrmShopEnquiryRecord | null;
  /** The client and work a deal is named after (lot won, Shop order). */
  dealNaming?: CrmDealNamingFacts;
  /** When the event is processed; names the month of a deal whose event carries no timestamp. */
  now?: Date;
};

function requireDealConfig(
  ctx: CrmMapperContext,
  stage: string | undefined,
): { ok: true; pipeline: string; stage: string } | { ok: false; reason: string } {
  const pipeline = ctx.auctionPipeline.trim();
  const resolvedStage = stage?.trim() ?? "";
  if (!pipeline || !resolvedStage) {
    return { ok: false, reason: "deal_pipeline_or_stage_not_configured" };
  }
  return { ok: true, pipeline, stage: resolvedStage };
}

/**
 * The deal name under the LAX naming convention. The reference stands in for the stock number
 * when the work has no register stock code; with no facts at all the name is the reference, deal
 * type and month.
 */
function dealNameFor(
  facts: CrmDealNamingFacts | undefined,
  dealType: DealType,
  at: Date,
  fallbackReference: string,
): string {
  return formatDealName({
    client: clientLabel({ personName: facts?.clientName }),
    stockCode: facts?.stockCode,
    reference: facts?.reference ?? fallbackReference,
    additionalWorks: facts?.additionalWorks ?? 0,
    dealType,
    at,
  });
}

function parsePayload(event: DomainEventRowForCrm): unknown | null {
  const parsed = parseDomainEventPayload(event.eventType, event.schemaVersion ?? 1, event.payload);
  return parsed.ok ? parsed.data : null;
}

const GUEST_LEAD_STATUS_LABEL = {
  abandoned_checkout: "abandoned checkout",
  ordered: "ordered",
  enquired: "enquired",
} as const;

const ENQUIRY_INTENT_LABEL: Readonly<Record<string, string>> = {
  private_sale_sell: "Sell privately",
  private_sale_buy: "Buy privately",
};
const ENQUIRY_INTENT_GENERAL = "General";

function mapEnquiryReceived(
  enquiry: CrmEnquiryRecord | null | undefined,
  attribution: Record<string, CrmFieldValue> | null | undefined,
  leadStatusNew: string,
): CrmMappedIntent {
  if (!enquiry) return { kind: "skip", reason: "enquiry_not_found" };
  // A signed-in sender keeps their account's lead; a guest gets a lead keyed by the enquiry.
  const subjectId = enquiry.userId ?? `enquiry:${enquiry.id}`;
  const isPrivateSale = enquiry.intent.startsWith("private_sale");
  const fields = withAttribution(
    personBaseFields(enquiry.email, enquiry.name, "bid", {
      detailedSource: isPrivateSale
        ? CRM_LEAD_SOURCE_BID_PRIVATE_SALE_ENQUIRY
        : CRM_LEAD_SOURCE_BID_ENQUIRY,
      enquiryType: enquiryTypeFor(enquiry.intent, enquiry.departmentSlug),
    }),
    attribution,
  );
  fields[CRM_FIELD.subjectExternalId] = subjectId;
  Object.assign(
    fields,
    interestFields(enquiry.artist),
    consentFields({ optIn: enquiry.marketingOptIn, at: enquiry.createdAt }),
    noticeConfirmedFields(),
  );
  fields[CRM_FIELD.enquiryIntent] = ENQUIRY_INTENT_LABEL[enquiry.intent] ?? ENQUIRY_INTENT_GENERAL;
  fields[CRM_FIELD.enquiryReference] = enquiry.reference;
  if (enquiry.departmentSlug) fields[CRM_FIELD.enquiryDepartment] = enquiry.departmentSlug;
  if (enquiry.phone) fields.Phone = enquiry.phone;
  return {
    kind: "person_upsert",
    subjectId,
    email: enquiry.email,
    fields,
    createOnlyFields: newLeadFields(leadStatusNew),
  };
}

/**
 * A signed-in person's enquiry about a Shop original is a Lead, like every website enquiry:
 * staff convert it by hand. The Lead is the account's own, so a repeat enquiry updates it.
 */
function mapShopEnquiryInterest(
  enquiry: CrmShopEnquiryRecord | null | undefined,
  subjectId: string,
  ctx: CrmMapperContext,
): CrmMappedIntent {
  if (!enquiry) return { kind: "skip", reason: "shop_enquiry_not_found" };
  // A relative link is no use in the CRM: without the public origin, send no link at all.
  const link = ctx.artPublicUrl
    ? `${ctx.artPublicUrl.replace(/\/+$/, "")}/artworks/${encodeURIComponent(enquiry.artworkSlug)}`
    : null;
  const work = [enquiry.stockCode, link, enquiry.artworkTitle].filter(Boolean).join(" ");
  const fields = withAttribution(
    personBaseFields(enquiry.email, enquiry.name ?? undefined, "shop", {
      detailedSource: `${CRM_LEAD_SOURCE_SHOP_ENQUIRY}: ${work}`,
      enquiryType: "Original",
    }),
    ctx.attribution,
  );
  fields[CRM_FIELD.subjectExternalId] = subjectId;
  if (enquiry.reference) fields[CRM_FIELD.enquiryReference] = enquiry.reference;
  if (enquiry.phone) fields.Phone = enquiry.phone;
  return {
    kind: "person_upsert",
    subjectId,
    email: enquiry.email,
    fields,
    createOnlyFields: newLeadFields(ctx.leadStatusNew),
  };
}

function personBaseFields(
  email: string,
  name: string | undefined,
  channel: "bid" | "shop" | "identity",
  lead: { detailedSource: string; enquiryType: CrmEnquiryType },
): Record<string, CrmFieldValue> {
  const { firstName, lastName } = splitDisplayName(name ?? "", email);
  const fields: Record<string, CrmFieldValue> = {
    Email: email,
    Last_Name: lastName,
    ...websiteLeadFields(lead),
  };
  if (firstName) fields.First_Name = firstName;
  if (channel === "bid") {
    fields[CRM_FIELD.eligibilityBid] = true;
  }
  if (channel === "shop") {
    fields[CRM_FIELD.eligibilityArt] = true;
  }
  return fields;
}

function withAttribution(
  fields: Record<string, CrmFieldValue>,
  attribution: Record<string, CrmFieldValue> | null | undefined,
): Record<string, CrmFieldValue> {
  if (!attribution) return fields;
  return { ...fields, ...attribution };
}

export function mapDomainEventToCrmIntent(
  event: DomainEventRowForCrm,
  ctx: CrmMapperContext,
  resolved: CrmMapperResolved = {},
): CrmMappedIntent {
  const payload = parsePayload(event);
  if (payload === null && event.eventType.startsWith("user.")) {
    return { kind: "skip", reason: "invalid_payload" };
  }

  switch (event.eventType) {
    case "user.registered": {
      const p = payload as {
        userId: string;
        email: string;
        name: string;
        source: string;
        phone?: string | null;
      };
      // A sign-up records no marketing consent, so none is sent: the lead is never opted in.
      const fields = withAttribution(
        personBaseFields(p.email, p.name, "identity", {
          detailedSource: CRM_LEAD_SOURCE_SIGN_UP,
          enquiryType: "General",
        }),
        ctx.attribution,
      );
      fields[CRM_FIELD.subjectExternalId] = p.userId;
      if (p.phone) fields.Phone = p.phone;
      return {
        kind: "person_upsert",
        subjectId: p.userId,
        email: p.email,
        fields,
        createOnlyFields: newLeadFields(ctx.leadStatusNew),
      };
    }
    case "user.email_verified": {
      const p = payload as { userId: string; email: string };
      return {
        kind: "person_patch",
        subjectId: p.userId,
        fields: { Email: p.email },
      };
    }
    case "user.profile_updated": {
      const p = payload as {
        subjectId: string;
        email?: string;
        name?: string;
        phone?: string | null;
      };
      const fields: Record<string, CrmFieldValue> = {};
      if (p.email !== undefined) fields.Email = p.email;
      if (p.name !== undefined) {
        const { firstName, lastName } = splitDisplayName(p.name, p.email ?? "");
        fields.Last_Name = lastName;
        if (firstName) fields.First_Name = firstName;
      }
      if (p.phone !== undefined) fields.Phone = p.phone;
      if (Object.keys(fields).length === 0) {
        return { kind: "skip", reason: "empty_profile_patch" };
      }
      return { kind: "person_patch", subjectId: p.subjectId, fields };
    }
    case "user.deletion_requested": {
      const p = payload as { subjectId: string };
      return { kind: "deletion_requested", subjectId: p.subjectId };
    }
    case "user.deletion_cancelled": {
      const p = payload as { subjectId: string };
      return { kind: "deletion_cancelled", subjectId: p.subjectId };
    }
    case "user.identity_deleted": {
      const p = payload as { subjectId: string };
      return { kind: "erase_subject", subjectId: p.subjectId };
    }
    case "user.identity_merged": {
      const p = payload as { subjectId: string; retiredSubjectId: string };
      return {
        kind: "merge_subjects",
        subjectId: p.subjectId,
        retiredSubjectId: p.retiredSubjectId,
      };
    }
    case "bid.first_for_user": {
      if (payload === null) return { kind: "skip", reason: "invalid_payload" };
      const p = payload as { userId: string };
      return {
        kind: "person_patch",
        subjectId: p.userId,
        fields: { [CRM_FIELD.eligibilityBid]: true },
      };
    }
    case "bid.lot_won": {
      if (payload === null) return { kind: "skip", reason: "invalid_payload" };
      const p = payload as {
        lotId: string;
        userId: string;
        amountCents: number;
        endedAt: string;
      };
      const dealKey = lotWonDealKey(p.lotId);
      const dealConfig = requireDealConfig(ctx, ctx.dealStageLotWon);
      if (!dealConfig.ok) return { kind: "skip", reason: dealConfig.reason };
      return {
        kind: "deal_upsert",
        dealEntityId: lotWonDealEntityId(p.lotId),
        dealKey,
        subjectId: p.userId,
        purchase: { product: "LAX Bid", paid: false },
        fields: {
          Deal_Name: dealNameFor(resolved.dealNaming, "Acquisition", new Date(p.endedAt), p.lotId),
          Amount: p.amountCents / 100,
          Stage: dealConfig.stage,
          Pipeline: dealConfig.pipeline,
          Closing_Date: p.endedAt.slice(0, 10),
          [CRM_FIELD.dealExternalKey]: dealKey,
        },
      };
    }
    case "payment.captured": {
      if (payload === null) return { kind: "skip", reason: "invalid_payload" };
      const p = payload as { lotId: string; amountCents: number; capturedAt: string };
      const dealConfig = requireDealConfig(ctx, ctx.dealStagePaymentCaptured);
      if (!dealConfig.ok) return { kind: "skip", reason: dealConfig.reason };
      return {
        kind: "purchase_paid",
        dealEntityId: lotWonDealEntityId(p.lotId),
        stage: dealConfig.stage,
        amount: p.amountCents / 100,
        paidAt: p.capturedAt,
      };
    }
    case "payment.refunded": {
      if (payload === null) return { kind: "skip", reason: "invalid_payload" };
      const lotId = resolved.paymentRefundLotId;
      if (!lotId) return { kind: "skip", reason: "payment_refund_missing_lot" };
      const dealConfig = requireDealConfig(ctx, ctx.dealStagePaymentRefunded);
      if (!dealConfig.ok) return { kind: "skip", reason: dealConfig.reason };
      return {
        kind: "deal_stage",
        dealEntityId: lotWonDealEntityId(lotId),
        stage: dealConfig.stage,
      };
    }
    case "shop.artwork.created": {
      if (payload === null) return { kind: "skip", reason: "invalid_payload" };
      const p = payload as {
        importKey: string;
        slug: string;
        eligibleForEditionAllocation: boolean;
      };
      return {
        kind: "shop_artwork_product_upsert",
        aggregateId: event.aggregateId,
        importKey: p.importKey,
        slug: p.slug,
        eligibleForEditionAllocation: p.eligibleForEditionAllocation,
      };
    }
    case "shop.artwork.interest_registered": {
      if (payload === null) return { kind: "skip", reason: "invalid_payload" };
      const p = payload as {
        artworkId: string;
        identitySubjectId: string;
        intent: "notify_me" | "enquiry";
      };
      if (p.intent !== "enquiry") {
        return { kind: "skip", reason: "interest_not_enquiry" };
      }
      return mapShopEnquiryInterest(resolved.shopEnquiry, p.identitySubjectId, ctx);
    }
    case "shop.guest_lead.recorded": {
      if (payload === null) return { kind: "skip", reason: "invalid_payload" };
      const p = payload as {
        leadSubjectId: string;
        email: string;
        name: string | null;
        status: keyof typeof GUEST_LEAD_STATUS_LABEL;
        source: string;
        marketingConsent: boolean;
        marketingConsentAt: string | null;
        marketingConsentVersion: string | null;
      };
      // The detailed source says which kind of guest lead it is; the subject keys it until a
      // LAX account claims it.
      const fields = withAttribution(
        personBaseFields(p.email, p.name ?? undefined, "shop", {
          detailedSource: `${CRM_LEAD_SOURCE_SHOP_GUEST} ${p.source}: ${GUEST_LEAD_STATUS_LABEL[p.status]}`,
          enquiryType: "Prints",
        }),
        ctx.attribution,
      );
      fields[CRM_FIELD.subjectExternalId] = p.leadSubjectId;
      Object.assign(
        fields,
        consentFields({
          optIn: p.marketingConsent,
          at: p.marketingConsentAt,
          wordingVersion: p.marketingConsentVersion,
        }),
        noticeConfirmedFields(),
      );
      return {
        kind: "person_upsert",
        subjectId: p.leadSubjectId,
        email: p.email,
        fields,
        createOnlyFields: newLeadFields(ctx.leadStatusNew),
      };
    }
    case "marketing_enquiry.received":
      return mapEnquiryReceived(resolved.enquiry, ctx.attribution, ctx.leadStatusNew);
    case "shop.guest_lead.claimed": {
      if (payload === null) return { kind: "skip", reason: "invalid_payload" };
      const p = payload as { leadSubjectId: string; subjectId: string };
      return { kind: "merge_subjects", subjectId: p.subjectId, retiredSubjectId: p.leadSubjectId };
    }
    case "shop.guest_lead.erased": {
      // Staff erased the guest's data on request: the CRM lead is deleted and purged from the
      // recycle bin, as for a closed account.
      if (payload === null) return { kind: "skip", reason: "invalid_payload" };
      const p = payload as { leadSubjectId: string };
      return { kind: "erase_subject", subjectId: p.leadSubjectId };
    }
    case "shop.order.paid": {
      if (payload === null) return { kind: "skip", reason: "invalid_payload" };
      const p = payload as {
        orderId: string;
        identitySubjectId: string;
        totalPence: number;
        paidAt: string;
      };
      const dealKey = shopOrderDealKey(p.orderId);
      const dealConfig = requireDealConfig(ctx, ctx.dealStageShopPaid);
      if (!dealConfig.ok) return { kind: "skip", reason: dealConfig.reason };
      return {
        kind: "deal_upsert",
        dealEntityId: shopOrderDealEntityId(p.orderId),
        dealKey,
        subjectId: p.identitySubjectId,
        purchase: { product: "LAX Shop", paid: true },
        fields: {
          Deal_Name: dealNameFor(
            resolved.dealNaming,
            resolved.dealNaming?.artworkKind === "original" ? "Acquisition" : "Print Order",
            new Date(p.paidAt),
            p.orderId,
          ),
          Amount: p.totalPence / 100,
          Stage: dealConfig.stage,
          Pipeline: dealConfig.pipeline,
          Closing_Date: p.paidAt.slice(0, 10),
          [CRM_FIELD.dealExternalKey]: dealKey,
        },
      };
    }
    default:
      return { kind: "skip", reason: "unmapped_event" };
  }
}
