import {
  type CatalogReadinessResult,
  lotEditResumeHref,
  lotPublishBlockedReason,
} from "@/lib/admin/catalog-readiness";
import { draftSaleLotPublishBanner } from "@/lib/admin/sale-setup/field-copy";
import type { HeldPayoutNotice } from "@/lib/admin/seller-proceeds/lot-seller-proceeds.vm";
import { formatStaffDateTime } from "@auction/staff-ui";
import type { LotStatus } from "@auction/types";

/** The one notice a lot page shows about the whole lot, most urgent first. */
export type LotDetailNotice = {
  id: "withdrawal" | "payout-held" | "connect" | "draft-sale" | "readiness";
  tone: "info" | "warning" | "danger";
  title: string;
  body: string;
  action: { label: string; href: string } | null;
  /** The notice's action is recording the seller's signed agreement, in a dialog. */
  recordsAgreement?: boolean;
};

/**
 * What stops the lot moving forward, as one notice: the seller cannot be paid (publishing fails
 * until they finish payout setup), the lot is published with its draft sale, or publish checks
 * are still open on a draft. Nothing when the lot has no blocker.
 */
export function lotDetailNotice(input: {
  lotId: string;
  status: LotStatus;
  connectRequired: boolean;
  sellerLegalEntityId: string | null;
  inDraftSale: boolean;
  readiness: CatalogReadinessResult | null;
  canManageCatalog: boolean;
  /** When the seller asked to withdraw the lot (ISO), while the request waits. */
  withdrawalRequestedAt?: string | null;
  /** A sold lot whose buyer has paid but whose seller payout is held. */
  heldPayout?: HeldPayoutNotice | null;
}): LotDetailNotice | null {
  if (input.withdrawalRequestedAt) {
    return {
      id: "withdrawal",
      tone: "warning",
      title: "The seller has asked to withdraw this lot",
      body: `Asked ${formatStaffDateTime(input.withdrawalRequestedAt)}. Approve or decline the request from the lot's actions.`,
      action: null,
    };
  }
  if (input.heldPayout) {
    const held = input.heldPayout;
    return {
      id: "payout-held",
      tone: "danger",
      title: held.title,
      body: held.body,
      action: held.settingsHref ? { label: "Open settings", href: held.settingsHref } : null,
      recordsAgreement: held.canRecord,
    };
  }
  if (input.status !== "draft") return null;
  if (input.connectRequired) {
    return {
      id: "connect",
      tone: "danger",
      title: "The seller cannot be paid yet",
      body: "Their payout account is not ready, so the lot cannot be published. Ask the seller to finish payout setup in their account, then publish again.",
      action: input.sellerLegalEntityId
        ? {
            label: "Open seller",
            href: `/admin/legal-entities/${encodeURIComponent(input.sellerLegalEntityId)}`,
          }
        : null,
    };
  }
  if (input.inDraftSale) {
    return {
      id: "draft-sale",
      tone: "info",
      title: "Published with its sale",
      body: draftSaleLotPublishBanner(),
      action: null,
    };
  }
  const readiness = input.readiness;
  if (readiness && readiness.percent < 100) {
    const blocker = lotPublishBlockedReason(readiness);
    return {
      id: "readiness",
      tone: blocker ? "warning" : "info",
      title: `${readiness.completeCount} of ${readiness.totalCount} publish checks complete`,
      body: blocker
        ? `Next: ${blocker}. The lot can be published once the required checks pass.`
        : "The required checks pass; the rest are recommended before publishing.",
      action: input.canManageCatalog
        ? { label: "Continue editing", href: lotEditResumeHref(input.lotId, readiness) }
        : null,
    };
  }
  return null;
}

/** The edit link a lot's state allows: the whole draft, the scheduled lot, or live copy only. */
export function lotEditLink(
  lotId: string,
  status: LotStatus,
): { label: string; href: string } | null {
  if (status === "draft") return { label: "Edit draft", href: `/admin/lots/${lotId}/edit` };
  if (status === "scheduled") return { label: "Edit lot", href: `/admin/lots/${lotId}/edit` };
  if (status === "active") {
    return { label: "Edit catalogue copy", href: `/admin/lots/${lotId}/edit/catalog` };
  }
  return null;
}
