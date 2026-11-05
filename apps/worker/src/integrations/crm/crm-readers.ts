import type { Database } from "@auction/db";
import {
  marketingAttribution,
  marketingEnquiry,
  payment,
  privateSaleEnquiryDetail,
} from "@auction/db/schema";
import { eq } from "drizzle-orm";
import { CRM_FIELD } from "./crm-field-constants.js";
import type { CrmFieldValue } from "./crm-gateway.js";

export interface CrmPaymentLotReader {
  findLotIdForPayment(paymentId: string): Promise<string | null>;
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
      if (typeof touch.utm_source === "string") fields[CRM_FIELD.utmSource] = touch.utm_source;
      if (typeof touch.utm_medium === "string") fields[CRM_FIELD.utmMedium] = touch.utm_medium;
      if (typeof touch.utm_campaign === "string")
        fields[CRM_FIELD.utmCampaign] = touch.utm_campaign;
      if (typeof touch.utm_content === "string") fields[CRM_FIELD.utmContent] = touch.utm_content;
      if (typeof touch.utm_term === "string") fields[CRM_FIELD.utmTerm] = touch.utm_term;
      if (typeof touch.landing_page === "string") {
        fields[CRM_FIELD.landingPageUrl] = touch.landing_page;
      }
      return Object.keys(fields).length > 0 ? fields : null;
    },
  };
}
