"use client";

import { CatalogDeleteEligibilityNotice } from "@/components/admin/catalog/catalog-delete-eligibility-notice";
import { CatalogInfoAside } from "@/components/admin/catalog/catalog-info-aside";
import { useCatalogPostCreateSession } from "@/components/admin/catalog/catalog-post-create-session";
import { CatalogReadinessChecklist } from "@/components/admin/catalog/catalog-readiness-checklist";
import {
  ActivitySnapshotRail,
  KpiStackRail,
  QuickActionsRail,
  RelatedEntitiesRail,
} from "@/components/admin/detail-rail";
import type { QuickActionItem } from "@/components/admin/detail-rail/quick-actions-rail";
import { sumLotHammers } from "@/components/admin/sale-detail/sale-detail-helpers";
import { saleDetailTabHref } from "@/components/admin/sale-detail/sale-detail-types";
import { shouldShowCatalogReadinessRail } from "@/lib/admin/catalog-detail-readiness-surface";
import type { CatalogReadinessResult } from "@/lib/admin/catalog-readiness";
import { saleDetailReadinessDismissKey } from "@/lib/admin/compute-sale-detail-readiness";
import type { ConnectRequiredByLotId } from "@/lib/admin/connect-readiness";
import { domainEventLabel } from "@/lib/admin/domain-event-labels";
import type { AdminDomainEventRow } from "@/lib/data/http/admin.server";
import type { Lot, Sale } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  saleId: string;
  sale: Sale;
  lots: Lot[];
  liveish: boolean;
  registrationCount: number | null;
  activityEvents?: readonly AdminDomainEventRow[];
  deleteBlockers?: readonly string[];
  canManageSales?: boolean;
  connectRequiredByLotId?: ConnectRequiredByLotId;
  draftSetupReadiness?: CatalogReadinessResult | null;
  quickRailItems?: readonly QuickActionItem[];
  draftSetupHref?: string;
  status?: ReactNode;
  publicHref?: string;
};

export function SaleContextRail({
  saleId,
  sale,
  lots,
  liveish,
  registrationCount,
  activityEvents = [],
  deleteBlockers = [],
  canManageSales = false,
  connectRequiredByLotId: _connectRequiredByLotId,
  draftSetupReadiness = null,
  quickRailItems = [],
  status,
  publicHref,
}: Props) {
  const { isPostCreateBannerActive } = useCatalogPostCreateSession();
  const readiness = draftSetupReadiness;
  const showRailReadiness = shouldShowCatalogReadinessRail({
    readiness,
    isPostCreateBannerActive: isPostCreateBannerActive(readiness),
  });

  const pendingRegs =
    liveish && registrationCount != null && registrationCount > 0 ? registrationCount : 0;

  return (
    <div className="space-y-6 lg:sticky lg:top-28">
      <CatalogInfoAside
        entityId={saleId}
        updatedAt={sale.updatedAt}
        {...(publicHref ? { publicHref, publicLabel: "View on site" } : {})}
        {...(status ? { status } : {})}
      />
      <div className="space-y-6 rounded-xl border border-border-hairline bg-surface-container-low/60 p-5">
        <KpiStackRail
          items={[
            { id: "lots", label: "Lots", value: String(lots.length) },
            { id: "hammer", label: "Aggregate hammer", value: sumLotHammers(lots) },
            {
              id: "registrations",
              label: "Registrations",
              value: !liveish ? "—" : String(registrationCount ?? 0),
              tone: pendingRegs > 0 ? "warning" : "default",
            },
          ]}
        />
        <QuickActionsRail actions={quickRailItems} />
        <RelatedEntitiesRail
          title="Quick links"
          items={[
            {
              id: "lots",
              kind: "Tab",
              label: `${lots.length} catalog lots`,
              href: saleDetailTabHref(saleId, "lots"),
            },
            ...(liveish
              ? [
                  {
                    id: "registrations",
                    kind: "Tab",
                    label: "Bidder registrations",
                    href: saleDetailTabHref(saleId, "registrations"),
                    ...(registrationCount != null ? { meta: `${registrationCount} on file` } : {}),
                  },
                ]
              : []),
          ]}
        />
        {liveish ? (
          <Button variant="outline" size="sm" className="w-full" asChild>
            <Link href={saleDetailTabHref(saleId, "registrations")}>
              Review registrations
              {registrationCount != null ? ` (${registrationCount})` : ""}
            </Link>
          </Button>
        ) : null}
        {showRailReadiness && readiness ? (
          <CatalogReadinessChecklist
            title="Publish readiness"
            readiness={readiness}
            variant="compact"
            dismissKey={saleDetailReadinessDismissKey(saleId)}
          />
        ) : null}
        {deleteBlockers.length > 0 && canManageSales ? (
          <CatalogDeleteEligibilityNotice blockers={deleteBlockers} entityLabel="sale" />
        ) : null}
        <ActivitySnapshotRail
          events={activityEvents.map((e) => ({
            id: e.id,
            label: domainEventLabel(e.eventType),
            at: e.occurredAt.toISOString(),
            actor: e.actorUserId,
          }))}
          viewAllHref={saleDetailTabHref(saleId, "activity")}
          viewAllLabel="View all activity"
        />
      </div>
    </div>
  );
}
