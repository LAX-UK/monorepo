"use client";

import { buyerPremiumSummary } from "@/components/admin/sale-detail/sale-detail-helpers";
import type { ConnectRequiredByLotId } from "@/lib/admin/connect-readiness-shared";
import {
  buildSaleSetupReadiness,
  draftSaleLotPublishBanner,
  isSaleSetupPublishReady,
  publishBlockedCatalogueRoleMessage,
  saleSetupHref,
} from "@/lib/admin/sale-setup";
import { deliveryModeShortLabel } from "@/lib/presenters/delivery-mode/delivery-mode-registry";
import {
  IssueList,
  Notice,
  ReviewSection,
  type StaffLinkComponent,
  formatStaffDateTime,
} from "@auction/staff-ui";
import type { Lot, Sale } from "@auction/types";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Props = {
  saleId: string;
  sale: Sale;
  lots: Lot[];
  pendingRegistrationCount?: number | null;
  canPublish: boolean;
  connectRequiredByLotId?: ConnectRequiredByLotId;
  onEditSummary?: () => void;
  documentCount?: number;
};

const NextLink: StaffLinkComponent = Link;

/**
 * Check your answers before publishing: what still blocks it, then each step's answers with
 * Change to go back to it.
 */
export function SaleSetupReviewStep({
  saleId,
  sale,
  lots,
  pendingRegistrationCount = null,
  canPublish,
  connectRequiredByLotId,
  documentCount = 0,
}: Props) {
  const router = useRouter();
  const readiness = buildSaleSetupReadiness({
    saleId,
    sale,
    lots,
    pendingRegistrationCount,
    ...(connectRequiredByLotId ? { connectRequiredByLotId } : {}),
    setupStepHref: (step) => saleSetupHref(saleId, step),
  });
  const failing = readiness.items.filter((item) => !item.ok);
  const go = (step: Parameters<typeof saleSetupHref>[1]) =>
    router.push(saleSetupHref(saleId, step));

  return (
    <>
      <Notice tone="info" title="The sale's lots are published with it">
        {draftSaleLotPublishBanner()}
      </Notice>
      {!canPublish ? (
        <Notice tone="info" title="Someone who manages sales publishes it">
          {publishBlockedCatalogueRoleMessage()}
        </Notice>
      ) : null}
      <IssueList
        Link={NextLink}
        title="Before you publish"
        allClear="Every check passes. The sale is ready to publish."
        items={failing.map((item) => ({
          id: item.id,
          label: item.label,
          tone: item.severity === "required" ? ("danger" as const) : ("warning" as const),
          tag: item.severity === "required" ? "Required" : "Recommended",
          ...(item.href ? { action: { label: "Fix", href: item.href } } : {}),
        }))}
      />
      <ReviewSection
        title="Sale details"
        onChange={() => go("identity")}
        items={[
          { label: "Title", value: sale.title },
          { label: "Description", value: sale.description?.trim() ? "Added" : null },
        ]}
      />
      <ReviewSection
        title="Schedule"
        onChange={() => go("schedule")}
        items={[
          { label: "Format", value: deliveryModeShortLabel(sale.deliveryMode) },
          { label: "Opens", value: formatStaffDateTime(sale.startTime, { zoneLabel: true }) },
          { label: "Closes", value: formatStaffDateTime(sale.endTime, { zoneLabel: true }) },
          { label: "Buyer's premium", value: buyerPremiumSummary(sale) },
        ]}
      />
      <ReviewSection
        title="Documents"
        onChange={() => go("documents")}
        items={[
          { label: "Documents", value: String(documentCount), numeric: true },
          { label: "Terms of sale", value: sale.terms?.trim() ? "Added" : null },
        ]}
      />
      <ReviewSection
        title="Lots"
        onChange={() => go("lots")}
        items={[{ label: "Lots in the sale", value: String(lots.length), numeric: true }]}
      />
    </>
  );
}

export function isSaleSetupReadyToPublish(
  saleId: string,
  sale: Sale,
  lots: Lot[],
  pendingRegistrationCount: number | null = null,
  connectRequiredByLotId?: ConnectRequiredByLotId,
): boolean {
  return isSaleSetupPublishReady({
    saleId,
    sale,
    lots,
    pendingRegistrationCount,
    ...(connectRequiredByLotId ? { connectRequiredByLotId } : {}),
  });
}
