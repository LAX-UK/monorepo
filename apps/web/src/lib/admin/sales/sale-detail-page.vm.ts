import type { CatalogReadinessResult } from "@/lib/admin/catalog-readiness";
import type { SaleStatus } from "@auction/types";

/** The one notice a sale page shows about the whole sale, most urgent first. */
export type SaleDetailNotice = {
  id: "connect" | "atg" | "readiness";
  tone: "info" | "warning" | "danger";
  title: string;
  body: string;
  action: { label: string; href: string } | null;
};

/**
 * What stops the sale moving forward, as one notice: a seller who cannot be paid (publishing
 * fails until they finish payout setup), a sale that sells on ATG and is managed there, or a
 * draft with setup checks still open. Nothing when the sale has no blocker.
 */
export function saleDetailNotice(input: {
  status: SaleStatus;
  connectRequired: boolean;
  blockedSellerLegalEntityId: string | null;
  sellingOnAtg: boolean;
  readiness: CatalogReadinessResult | null;
  setupHref: string | null;
}): SaleDetailNotice | null {
  if (input.status === "draft" && input.connectRequired) {
    return {
      id: "connect",
      tone: "danger",
      title: "A seller in this sale cannot be paid yet",
      body: "Their payout account is not ready, so the sale cannot be published. Ask the seller to finish payout setup in their account, then publish again.",
      action: input.blockedSellerLegalEntityId
        ? {
            label: "Open seller",
            href: `/admin/legal-entities/${encodeURIComponent(input.blockedSellerLegalEntityId)}`,
          }
        : null,
    };
  }
  if (input.sellingOnAtg && (input.status === "draft" || input.status === "scheduled")) {
    return {
      id: "atg",
      tone: "info",
      title: "This sale sells on ATG",
      body: "It is published, cancelled and deleted on ATG, not here. Its lots and details still sync from this page.",
      action: null,
    };
  }
  const readiness = input.readiness;
  if (input.status === "draft" && readiness && readiness.percent < 100) {
    return {
      id: "readiness",
      tone: "warning",
      title: `${readiness.completeCount} of ${readiness.totalCount} setup checks complete`,
      body: "The sale can be published once every check passes. The open checks are listed on its overview.",
      action: input.setupHref ? { label: "Continue setup", href: input.setupHref } : null,
    };
  }
  return null;
}

/**
 * The header's edit link. While setup is open the sale's notice already carries "Continue setup",
 * so the header says "Edit draft" instead of offering the same link twice; with another notice
 * in front (an unpayable seller, ATG), the header keeps "Continue setup".
 */
export function saleEditLink(input: {
  status: SaleStatus;
  canManage: boolean;
  liveish: boolean;
  editHref: string;
  setupHref: string | null;
  setupOpen: boolean;
  notice: SaleDetailNotice | null;
}): { label: string; href: string } | null {
  if (!input.canManage) return null;
  if (input.status === "draft") {
    const noticeHasSetup = input.notice?.action?.label === "Continue setup";
    return input.setupOpen && input.setupHref && !noticeHasSetup
      ? { label: "Continue setup", href: input.setupHref }
      : { label: "Edit draft", href: input.editHref };
  }
  return input.liveish ? { label: "Edit details", href: input.editHref } : null;
}

/** The first lot whose seller cannot be paid, for the notice's link. */
export function firstBlockedSeller(
  lots: ReadonlyArray<{ id: string; sellerLegalEntityId?: string | null | undefined }>,
  connectRequiredByLotId: Readonly<Record<string, boolean>> | undefined,
): { blocked: boolean; sellerLegalEntityId: string | null } {
  const lot = connectRequiredByLotId ? lots.find((item) => connectRequiredByLotId[item.id]) : null;
  return { blocked: Boolean(lot), sellerLegalEntityId: lot?.sellerLegalEntityId ?? null };
}
