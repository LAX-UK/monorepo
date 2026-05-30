"use client";

import { CatalogDeleteEligibilityNotice } from "@/components/admin/catalog/catalog-delete-eligibility-notice";
import { CatalogInfoAside } from "@/components/admin/catalog/catalog-info-aside";
import { useCatalogPostCreateSession } from "@/components/admin/catalog/catalog-post-create-session";
import { CatalogReadinessChecklist } from "@/components/admin/catalog/catalog-readiness-checklist";
import {
  ActivitySnapshotRail,
  KpiStackRail,
  RelatedEntitiesRail,
} from "@/components/admin/detail-rail";
import { lotDetailTabHref } from "@/components/admin/lot-detail/lot-detail-types";
import { shouldShowCatalogReadinessRail } from "@/lib/admin/catalog-detail-readiness-surface";
import type { CatalogReadinessResult } from "@/lib/admin/catalog-readiness";
import { lotDetailReadinessDismissKey } from "@/lib/admin/compute-lot-detail-readiness";
import { domainEventLabel } from "@/lib/admin/domain-event-labels";
import type { LotDetailContext } from "@/lib/admin/lot-detail-context";
import type { AdminDomainEventRow } from "@/lib/data/http/admin.server";
import { formatMoney } from "@/lib/ui/format";
import type { Lot } from "@auction/types";
import { Building2, Palette, User } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  lotId: string;
  auction: Lot;
  context: LotDetailContext;
  bidCount: number | null;
  activityEvents?: readonly AdminDomainEventRow[];
  publishReadiness?: CatalogReadinessResult | null;
  deleteBlockers?: readonly string[];
  canManageAuction?: boolean;
  status?: ReactNode;
  publicHref?: string;
  quickActions?: ReactNode;
};

export function LotContextRail({
  lotId,
  auction,
  context,
  bidCount,
  activityEvents = [],
  publishReadiness = null,
  deleteBlockers = [],
  canManageAuction = false,
  status,
  publicHref,
  quickActions,
}: Props) {
  const { isPostCreateBannerActive } = useCatalogPostCreateSession();
  const readiness = publishReadiness;
  const showRailReadiness = shouldShowCatalogReadinessRail({
    readiness,
    isPostCreateBannerActive: isPostCreateBannerActive(readiness),
  });

  const related = [
    ...(context.sale
      ? [
          {
            id: context.sale.id,
            kind: "Sale",
            label: context.sale.title,
            href: `/admin/sales/${context.sale.id}`,
            icon: <Building2 className="size-4" aria-hidden />,
          },
        ]
      : []),
    ...(context.artist
      ? [
          {
            id: context.artist.id,
            kind: "Artist",
            label: context.artist.displayName,
            href: `/admin/artists/${context.artist.id}`,
            icon: <Palette className="size-4" aria-hidden />,
          },
        ]
      : []),
    ...(context.seller
      ? [
          {
            id: context.seller.id,
            kind: "Seller",
            label: context.seller.displayName,
            href: `/admin/legal-entities/${context.seller.id}`,
            icon: <User className="size-4" aria-hidden />,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6 lg:sticky lg:top-28">
      <CatalogInfoAside
        entityId={lotId}
        updatedAt={auction.updatedAt}
        {...(publicHref ? { publicHref, publicLabel: "View on site" } : {})}
        {...(status ? { status } : {})}
      />
      <div className="space-y-6 rounded-xl border border-border-hairline bg-surface-container-low/60 p-5">
        <KpiStackRail
          items={[
            {
              id: "hammer",
              label: "Current hammer",
              value: formatMoney(auction.currentPrice),
            },
            {
              id: "bids",
              label: "Bids",
              value: bidCount == null ? "—" : String(bidCount),
            },
            {
              id: "images",
              label: "Images",
              value: String(auction.images.length),
              tone:
                auction.status === "draft" && auction.images.length === 0 ? "warning" : "default",
            },
          ]}
        />
        {quickActions}
        <RelatedEntitiesRail items={related} />
        {showRailReadiness && readiness ? (
          <CatalogReadinessChecklist
            title="Publish readiness"
            readiness={readiness}
            variant="compact"
            dismissKey={lotDetailReadinessDismissKey(lotId)}
          />
        ) : null}
        {deleteBlockers.length > 0 && canManageAuction ? (
          <CatalogDeleteEligibilityNotice blockers={deleteBlockers} entityLabel="lot" />
        ) : null}
        <ActivitySnapshotRail
          events={activityEvents.map((e) => ({
            id: e.id,
            label: domainEventLabel(e.eventType),
            at: e.occurredAt.toISOString(),
            actor: e.actorUserId,
          }))}
          viewAllHref={lotDetailTabHref(lotId, "activity")}
          viewAllLabel="View all activity"
        />
      </div>
    </div>
  );
}
