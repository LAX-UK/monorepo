import { CatalogInfoAside } from "@/components/admin/catalog/catalog-info-aside";
import { CatalogPublishReadiness } from "@/components/admin/catalog/catalog-publish-readiness";
import {
  ActivitySnapshotRail,
  KpiStackRail,
  QuickActionsRail,
  RelatedEntitiesRail,
} from "@/components/admin/detail-rail";
import { sumLotHammers } from "@/components/admin/sale-detail/sale-detail-helpers";
import { saleDetailTabHref } from "@/components/admin/sale-detail/sale-detail-types";
import { buildSalePublishReadiness } from "@/lib/admin/catalog-readiness";
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
  status,
  publicHref,
}: Props) {
  const readiness =
    sale.status === "draft" || sale.status === "scheduled"
      ? buildSalePublishReadiness(saleId, sale, lots.length, registrationCount)
      : null;

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
        <QuickActionsRail
          actions={[
            ...(liveish
              ? [
                  {
                    id: "saleroom",
                    label: "Open saleroom",
                    href: `/admin/saleroom/${saleId}`,
                    variant: "default" as const,
                  },
                ]
              : []),
            ...(sale.status === "draft"
              ? [
                  {
                    id: "edit",
                    label: "Edit draft",
                    href: `/admin/sales/${saleId}/edit`,
                    variant: "outline" as const,
                  },
                ]
              : []),
            ...(publicHref
              ? [
                  {
                    id: "public",
                    label: "View on site",
                    href: publicHref,
                    variant: "outline" as const,
                  },
                ]
              : []),
          ]}
        />
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
        {readiness ? (
          <CatalogPublishReadiness
            title="Publish readiness"
            readiness={readiness}
            dismissKey={`sale:${saleId}`}
            compact
          />
        ) : null}
        {deleteBlockers.length > 0 ? (
          <div className="rounded-lg border border-border-hairline bg-surface-container-low px-4 py-3">
            <p className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
              Cannot delete
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-4 font-body text-sm text-on-surface-variant">
              {deleteBlockers.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
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
