import type { Database } from "@auction/db";
import {
  domainEvent,
  domainEventDelivery,
  marketingAttribution,
  marketingEnquiry,
  payment,
  privateSaleEnquiryDetail,
  shopOrder,
  shopRefund,
} from "@auction/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { CRM_FIELD } from "./crm-field-constants.js";
import type { CrmFieldValue } from "./crm-gateway.js";

export interface CrmPaymentLotReader {
  findLotIdForPayment(paymentId: string): Promise<string | null>;
}

/** A Shop refund and its order's refund state, in pence, as the order's status is worked out. */
export type CrmShopRefundRecord = {
  amountPence: number;
  /** Every succeeded refund on the order, this one included. */
  refundedTotalPence: number;
  orderTotalPence: number;
};

export interface CrmShopRefundReader {
  findById(refundId: string): Promise<CrmShopRefundRecord | null>;
}

/** The event that creates a deal, such as `shop.order.paid` for a Shop order's. */
export type CrmDealSource = { aggregateType: string; aggregateId: string; eventType: string };

export interface CrmDealSourceReader {
  /** True while the CRM delivery of the event is still to run: pending, processing or retrying. */
  isDeliveryInFlight(source: CrmDealSource): Promise<boolean>;
}

export interface CrmAttributionReader {
  loadFirstTouchFields(userId: string): Promise<Record<string, CrmFieldValue> | null>;
}

/**
 * The parts of an enquiry the CRM receives. The price in mind, the message and attachments are
 * deliberately not part of it.
 */
export type CrmEnquiryRecord = {
  id: string;
  reference: string;
  intent: string;
  departmentSlug: string | null;
  name: string;
  email: string;
  phone: string | null;
  marketingOptIn: boolean;
  /** When the enquiry was sent; the time consent was given when it opted in. */
  createdAt: Date;
  /** The artist a private sale enquiry names, when it does. */
  artist: string | null;
  /** The signed-in account that sent the enquiry, when there was one. */
  userId: string | null;
};

export interface CrmEnquiryReader {
  findById(enquiryId: string): Promise<CrmEnquiryRecord | null>;
}

export function createDrizzleCrmEnquiryReader(db: Database): CrmEnquiryReader {
  return {
    async findById(enquiryId: string): Promise<CrmEnquiryRecord | null> {
      const [row] = await db
        .select({
          id: marketingEnquiry.id,
          reference: marketingEnquiry.reference,
          intent: marketingEnquiry.intent,
          departmentSlug: marketingEnquiry.departmentSlug,
          name: marketingEnquiry.name,
          email: marketingEnquiry.email,
          phone: marketingEnquiry.phone,
          marketingOptIn: marketingEnquiry.marketingOptIn,
          userId: marketingEnquiry.userId,
          createdAt: marketingEnquiry.createdAt,
          artist: privateSaleEnquiryDetail.artist,
        })
        .from(marketingEnquiry)
        .leftJoin(
          privateSaleEnquiryDetail,
          eq(privateSaleEnquiryDetail.enquiryId, marketingEnquiry.id),
        )
        .where(eq(marketingEnquiry.id, enquiryId))
        .limit(1);
      return row ?? null;
    },
  };
}

export function createDrizzleCrmPaymentLotReader(db: Database): CrmPaymentLotReader {
  return {
    async findLotIdForPayment(paymentId: string): Promise<string | null> {
      const [row] = await db
        .select({ lotId: payment.lotId })
        .from(payment)
        .where(eq(payment.id, paymentId))
        .limit(1);
      return row?.lotId ?? null;
    },
  };
}

/** Zoho's single-line text and URL fields hold 255 characters; a longer value is refused. */
const CRM_TEXT_FIELD_MAX = 255;

/**
 * A landing page that fits Zoho's URL field. A long one loses its query string first (the UTM
 * values in it are sent in their own fields), then is cut to the limit.
 */
export function landingPageForCrm(url: string): string {
  if (url.length <= CRM_TEXT_FIELD_MAX) return url;
  const withoutQuery = url.split(/[?#]/, 1)[0] ?? url;
  return withoutQuery.slice(0, CRM_TEXT_FIELD_MAX);
}

export function createDrizzleCrmAttributionReader(db: Database): CrmAttributionReader {
  return {
    async loadFirstTouchFields(userId: string): Promise<Record<string, CrmFieldValue> | null> {
      const [row] = await db
        .select({ firstTouch: marketingAttribution.firstTouch })
        .from(marketingAttribution)
        .where(eq(marketingAttribution.userId, userId))
        .limit(1);
      if (!row?.firstTouch || typeof row.firstTouch !== "object") return null;
      const touch = row.firstTouch as Record<string, unknown>;
      const fields: Record<string, CrmFieldValue> = {};
      const utm: ReadonlyArray<[string, string]> = [
        ["utm_source", CRM_FIELD.utmSource],
        ["utm_medium", CRM_FIELD.utmMedium],
        ["utm_campaign", CRM_FIELD.utmCampaign],
        ["utm_content", CRM_FIELD.utmContent],
        ["utm_term", CRM_FIELD.utmTerm],
      ];
      for (const [key, field] of utm) {
        const value = touch[key];
        if (typeof value === "string" && value.trim()) {
          fields[field] = value.trim().slice(0, CRM_TEXT_FIELD_MAX);
        }
      }
      if (typeof touch.landing_page === "string" && touch.landing_page.trim()) {
        fields[CRM_FIELD.landingPageUrl] = landingPageForCrm(touch.landing_page.trim());
      }
      return Object.keys(fields).length > 0 ? fields : null;
    },
  };
}

export function createDrizzleCrmShopRefundReader(db: Database): CrmShopRefundReader {
  return {
    async findById(refundId: string): Promise<CrmShopRefundRecord | null> {
      const [refund] = await db
        .select({
          orderId: shopRefund.orderId,
          amountPence: shopRefund.amountPence,
          orderTotalPence: shopOrder.totalPence,
        })
        .from(shopRefund)
        .innerJoin(shopOrder, eq(shopOrder.id, shopRefund.orderId))
        .where(eq(shopRefund.id, refundId))
        .limit(1);
      if (!refund) return null;
      // The same sum the Shop marks the order refunded from.
      const [refunded] = await db
        .select({ pence: sql<number>`coalesce(sum(${shopRefund.amountPence}), 0)::int` })
        .from(shopRefund)
        .where(and(eq(shopRefund.orderId, refund.orderId), eq(shopRefund.status, "succeeded")));
      return {
        amountPence: refund.amountPence,
        refundedTotalPence: refunded?.pence ?? 0,
        orderTotalPence: refund.orderTotalPence,
      };
    },
  };
}

const CRM_CONSUMER = "zoho";

export function createDrizzleCrmDealSourceReader(db: Database): CrmDealSourceReader {
  return {
    async isDeliveryInFlight(source: CrmDealSource): Promise<boolean> {
      const [row] = await db
        .select({ id: domainEventDelivery.id })
        .from(domainEventDelivery)
        .innerJoin(domainEvent, eq(domainEvent.id, domainEventDelivery.eventId))
        .where(
          and(
            eq(domainEventDelivery.consumer, CRM_CONSUMER),
            eq(domainEvent.aggregateType, source.aggregateType),
            eq(domainEvent.aggregateId, source.aggregateId),
            eq(domainEvent.eventType, source.eventType),
            inArray(domainEventDelivery.status, ["pending", "processing", "retryable"]),
          ),
        )
        .limit(1);
      return row !== undefined;
    },
  };
}
