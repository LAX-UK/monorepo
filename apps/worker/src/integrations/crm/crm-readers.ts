import type { Database } from "@auction/db";
import { marketingAttribution, payment } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import { CRM_FIELD } from "./crm-field-constants.js";
import type { CrmFieldValue } from "./crm-gateway.js";

export interface CrmPaymentLotReader {
  findLotIdForPayment(paymentId: string): Promise<string | null>;
}

export interface CrmAttributionReader {
  loadFirstTouchFields(userId: string): Promise<Record<string, CrmFieldValue> | null>;
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
