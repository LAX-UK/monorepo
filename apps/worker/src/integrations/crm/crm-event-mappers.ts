import { parseDomainEventPayload } from "@auction/types";
import {
  CRM_FIELD,
  CRM_LEAD_SOURCE_PLATFORM,
  lotWonDealKey,
  shopOrderDealKey,
} from "./crm-field-constants.js";
import type { CrmFieldValue } from "./crm-gateway.js";
import { splitDisplayName } from "./crm-name-fields.js";

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
    }
  | { kind: "person_patch"; subjectId: string; fields: Record<string, CrmFieldValue> }
  | {
      kind: "deal_upsert";
      dealEntityId: string;
      dealKey: string;
      subjectId: string;
      fields: Record<string, CrmFieldValue>;
    }
  | { kind: "deal_stage"; dealEntityId: string; stage: string }
  | {
      kind: "convert_lead_on_win";
      subjectId: string;
      dealEntityId: string;
      dealKey: string;
      dealFields: Record<string, CrmFieldValue>;
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

export type CrmMapperContext = {
  auctionPipeline: string;
  dealStageLotWon: string;
  dealStagePaymentCaptured: string;
  dealStagePaymentRefunded: string;
  dealStageShopPaid: string;
  dealStageShopEnquiry: string;
  attribution?: Record<string, CrmFieldValue> | null;
};

/** Values resolved outside the catalog payload (e.g. lot id for refunds). */
export type CrmMapperResolved = {
  paymentRefundLotId?: string;
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

function parsePayload(event: DomainEventRowForCrm): unknown | null {
  const parsed = parseDomainEventPayload(event.eventType, event.schemaVersion ?? 1, event.payload);
  return parsed.ok ? parsed.data : null;
}

function leadSourceDetailed(source: string, channel: "bid" | "shop" | "identity"): string {
  return `${channel}:${source}`.slice(0, 120);
}

function personBaseFields(
  email: string,
  name: string | undefined,
  channel: "bid" | "shop" | "identity",
  source: string,
): Record<string, CrmFieldValue> {
  const { firstName, lastName } = splitDisplayName(name ?? "", email);
  const fields: Record<string, CrmFieldValue> = {
    Email: email,
    Last_Name: lastName,
    [CRM_FIELD.leadSource]: CRM_LEAD_SOURCE_PLATFORM,
    [CRM_FIELD.leadSourceDetailed]: leadSourceDetailed(source, channel),
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
      const fields = withAttribution(
        personBaseFields(p.email, p.name, "identity", p.source),
        ctx.attribution,
      );
      fields[CRM_FIELD.subjectExternalId] = p.userId;
      if (p.phone) fields.Phone = p.phone;
      return { kind: "person_upsert", subjectId: p.userId, email: p.email, fields };
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
        kind: "convert_lead_on_win",
        subjectId: p.userId,
        dealEntityId: `lot-won:${p.lotId}`,
        dealKey,
        dealFields: {
          Deal_Name: `Lot won ${p.lotId}`,
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
      const p = payload as { lotId: string };
      const dealConfig = requireDealConfig(ctx, ctx.dealStagePaymentCaptured);
      if (!dealConfig.ok) return { kind: "skip", reason: dealConfig.reason };
      return {
        kind: "deal_stage",
        dealEntityId: `lot-won:${p.lotId}`,
        stage: dealConfig.stage,
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
        dealEntityId: `lot-won:${lotId}`,
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
      const dealKey = `shop-enquiry:${p.artworkId}:${p.identitySubjectId}`;
      const dealConfig = requireDealConfig(ctx, ctx.dealStageShopEnquiry);
      if (!dealConfig.ok) return { kind: "skip", reason: dealConfig.reason };
      return {
        kind: "deal_upsert",
        dealEntityId: dealKey,
        dealKey,
        subjectId: p.identitySubjectId,
        fields: {
          Deal_Name: `Shop original enquiry ${p.artworkId.slice(0, 8)}`,
          Stage: dealConfig.stage,
          Pipeline: dealConfig.pipeline,
          [CRM_FIELD.dealExternalKey]: dealKey,
        },
      };
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
        dealEntityId: `shop-order:${p.orderId}`,
        dealKey,
        subjectId: p.identitySubjectId,
        fields: {
          Deal_Name: `Shop order ${p.orderId}`,
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
