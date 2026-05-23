import { AdminPinPageButton } from "@/components/admin/admin-pin-page-button";
import { AdminSaleDetailKpiStrip } from "@/components/admin/admin-sale-detail-kpi-strip";
import { AdminSaleHeaderActions } from "@/components/admin/admin-sale-header-actions";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import {
  CatalogBreadcrumbs,
  CatalogDetailMobileMeta,
  CatalogDetailShell,
  CatalogDetailTabNav,
  CatalogInfoAside,
} from "@/components/admin/catalog";
import { AdminSaleEditableTitle } from "@/components/admin/editable-titles";
import { SaleDetailMobileActionBar } from "@/components/admin/sale-detail-mobile-action-bar";
import { SaleDetailAsideLinks } from "@/components/admin/sale-detail/sale-detail-aside-links";
import {
  isSaleLiveish,
  sumLotHammers,
  venueOneLiner,
} from "@/components/admin/sale-detail/sale-detail-helpers";
import {
  parseSaleDetailTabFromPath,
  saleDetailTabHref,
} from "@/components/admin/sale-detail/sale-detail-types";
import { clampCatalogDescription } from "@/lib/admin/catalog-detail-description";
import type { AdminSaleListRow } from "@/lib/data/http/admin.server";
import { salePath } from "@/lib/seo/url";
import { Badge } from "@auction/ui";
import type { ReactNode } from "react";

type Props = {
  saleId: string;
  bundle: AdminSaleListRow;
  registrationCount?: number | null;
  children: ReactNode;
};

export function SaleDetailShell({ saleId, bundle, registrationCount = null, children }: Props) {
  const { sale, lots } = bundle;
  const liveish = isSaleLiveish(sale);
  const venueLine = venueOneLiner(sale);
  const publicHref = salePath({ id: sale.id, title: sale.title });

  const canEdit = sale.status === "draft";
  const canPublish = sale.status === "draft";
  const canUnpublish = sale.status === "scheduled";
  const canCancel =
    sale.status === "draft" || sale.status === "scheduled" || sale.status === "active";
  const isOnsite = sale.deliveryMode === "onsite";
  const canMarkOnsiteEnded = isOnsite && (sale.status === "active" || sale.status === "scheduled");

  const tabSpecs = [
    { id: "overview", label: "Overview", href: saleDetailTabHref(saleId, "overview") },
    { id: "schedule", label: "Schedule", href: saleDetailTabHref(saleId, "schedule") },
    {
      id: "lots",
      label: `Lots${lots.length > 0 ? ` (${lots.length})` : ""}`,
      href: saleDetailTabHref(saleId, "lots"),
    },
    {
      id: "documents",
      label: "Documents",
      href: saleDetailTabHref(saleId, "documents"),
    },
    {
      id: "registrations",
      label: `Registrations${
        liveish && registrationCount != null && registrationCount > 0
          ? ` (${registrationCount})`
          : ""
      }`,
      href: saleDetailTabHref(saleId, "registrations"),
    },
  ];

  return (
    <CatalogDetailShell
      breadcrumbs={
        <CatalogBreadcrumbs
          segments={[{ label: "Sales", href: "/admin/sales" }, { label: sale.title }]}
        />
      }
      eyebrow="Sale"
      title={<AdminSaleEditableTitle saleId={saleId} value={sale.title} />}
      description={clampCatalogDescription(sale.description)}
      meta={
        <div className="flex flex-wrap items-center gap-2">
          <AdminStatusBadge domain="sale" status={sale.status} />
          <Badge variant="secondary" className="capitalize">
            {sale.deliveryMode}
          </Badge>
          <Badge variant="outline">
            {lots.length} lot{lots.length === 1 ? "" : "s"}
          </Badge>
        </div>
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <AdminPinPageButton label={sale.title} />
          <AdminSaleHeaderActions
            saleId={saleId}
            saleTitle={sale.title}
            canEdit={canEdit}
            canPublish={canPublish}
            canUnpublish={canUnpublish}
            canCancel={canCancel}
            canMarkOnsiteEnded={canMarkOnsiteEnded}
            showSaleroomLink={liveish}
          />
        </div>
      }
      mobileActionBar={
        <SaleDetailMobileActionBar
          saleId={saleId}
          publicHref={publicHref}
          canEdit={canEdit}
          liveish={liveish}
          canPublish={canPublish}
          canUnpublish={canUnpublish}
          canCancel={canCancel}
          canMarkOnsiteEnded={canMarkOnsiteEnded}
        />
      }
      mobileMeta={
        <CatalogDetailMobileMeta
          entityId={saleId}
          updatedAt={sale.updatedAt}
          publicHref={publicHref}
          publicLabel="View on site"
          status={<AdminStatusBadge domain="sale" status={sale.status} />}
        >
          <SaleDetailAsideLinks
            saleId={saleId}
            lotCount={lots.length}
            liveish={liveish}
            venueLine={venueLine}
          />
        </CatalogDetailMobileMeta>
      }
      aside={
        <CatalogInfoAside
          entityId={saleId}
          updatedAt={sale.updatedAt}
          publicHref={publicHref}
          publicLabel="View on site"
          status={<AdminStatusBadge domain="sale" status={sale.status} />}
        >
          <SaleDetailAsideLinks
            saleId={saleId}
            lotCount={lots.length}
            liveish={liveish}
            venueLine={venueLine}
          />
        </CatalogInfoAside>
      }
      tabs={
        <div className="space-y-6">
          <AdminSaleDetailKpiStrip
            saleId={saleId}
            sale={sale}
            lotCount={lots.length}
            aggregateHammer={sumLotHammers(lots)}
            liveish={liveish}
            registrationCount={registrationCount}
          />
          <CatalogDetailTabNav
            tabs={tabSpecs}
            resolveActiveTab={(pathname) => parseSaleDetailTabFromPath(pathname, saleId)}
            aria-label="Sale sections"
          />
          <div>{children}</div>
        </div>
      }
    >
      {null}
    </CatalogDetailShell>
  );
}
