"use client";

import { AdminQrCodeButton } from "@/components/admin/qr-code/admin-qr-code-button";
import { SaleDetailReadinessProvider } from "@/components/admin/sale-detail/sale-detail-readiness-context";
import { SaleDetailSectionNav } from "@/components/admin/sale-detail/sale-detail-section-nav";
import { type SaleActionTarget, useSaleActions } from "@/components/admin/sales/use-sale-actions";
import { StaffEditableTitle } from "@/components/admin/staff/staff-editable-title";
import {
  isPalettePinned,
  pushPaletteRecent,
  togglePalettePinned,
} from "@/components/layout/palette/palette-cookie-client";
import { adminUpdateSaleTitleFieldAction } from "@/lib/actions/admin/field-updates";
import type { CatalogReadinessResult } from "@/lib/admin/catalog-readiness";
import { adminSaleEditHref, adminSaleroomHref } from "@/lib/admin/catalog-route-helpers";
import {
  computeSaleDetailReadiness,
  saleDetailCanPublish,
} from "@/lib/admin/compute-sale-detail-readiness";
import type { ConnectRequiredByLotId } from "@/lib/admin/connect-readiness";
import { saleSetupResumeHref } from "@/lib/admin/sale-setup";
import { buildSaleDetailNav } from "@/lib/admin/sales/build-sale-detail-nav";
import { isSaleLiveish, venueOneLiner } from "@/lib/admin/sales/sale-detail-helpers";
import {
  firstBlockedSeller,
  saleDetailNotice,
  saleEditLink,
} from "@/lib/admin/sales/sale-detail-page.vm";
import { staffStatus } from "@/lib/admin/staff-kit-status";
import type { AdminSaleListRow } from "@/lib/data/http/admin.server";
import { SALEROOM_ACCESS, SALES_ACCESS } from "@/lib/navigation/staff-nav-access";
import { deliveryModeShortLabel } from "@/lib/presenters/delivery-mode/delivery-mode-registry";
import { salePath } from "@/lib/seo/url";
import {
  DetailPage,
  MetaItem,
  Notice,
  type OverflowAction,
  OverflowMenu,
  StaffBreadcrumbs,
  StaffButton,
  StaffDate,
  type StaffLinkComponent,
  StatusBadge,
} from "@auction/staff-ui";
import type { AtgOwnershipState } from "@auction/types";
import { isSaleroomDeliveryMode } from "@auction/validators";
import { CalendarDays, ExternalLink, Pencil, Pin, QrCode } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useState } from "react";

const NextLink: StaffLinkComponent = Link;

type Props = {
  saleId: string;
  bundle: AdminSaleListRow;
  registrationCount?: number | null;
  pendingRegistrationCount?: number | null;
  pendingTelephoneBookingCount?: number | null;
  documentCount?: number | null;
  canManageSales?: boolean;
  connectRequiredByLotId?: ConnectRequiredByLotId;
  /** Precomputed in the layout, so the overview and header share one readiness. */
  draftSetupReadiness?: CatalogReadinessResult | null;
  /** Open problems on the overview, for its tab count. */
  overviewAttentionCount?: number;
  /** From the ATG link when sync is on. */
  sellingPlatform?: AtgOwnershipState | null;
  linkedEventSlug?: string | null;
  linkedEventTitle?: string | null;
  children: ReactNode;
};

/**
 * A sale's page on the staff record template: where it sits, what it is (title, status, format,
 * dates, venue, lots), its next step as the one primary action (publish a draft, open the
 * saleroom of a live sale), the rest in the overflow menu with the lifecycle actions last, each
 * confirmed through the kit, one notice for what blocks it, and its sections as tabs.
 */
export function SaleDetailShell({
  saleId,
  bundle,
  registrationCount = null,
  pendingRegistrationCount = null,
  pendingTelephoneBookingCount = null,
  documentCount = null,
  canManageSales = false,
  connectRequiredByLotId,
  draftSetupReadiness: draftSetupReadinessProp,
  overviewAttentionCount = 0,
  sellingPlatform = null,
  linkedEventSlug = null,
  linkedEventTitle = null,
  children,
}: Props) {
  const router = useRouter();
  const pathname = usePathname() ?? `/admin/sales/${saleId}`;
  const searchParams = useSearchParams();
  const { sale, lots } = bundle;
  const liveish = isSaleLiveish(sale);
  const venue = venueOneLiner(sale);
  const publicHref = salePath({ id: sale.id, title: sale.title });
  const status = staffStatus("sale", sale.status);
  const sellingOnAtg = sellingPlatform === "atg";
  const isSaleroom = isSaleroomDeliveryMode(sale.deliveryMode);
  const pendingRegs =
    liveish && pendingRegistrationCount != null && pendingRegistrationCount > 0
      ? pendingRegistrationCount
      : 0;

  const setupReadiness =
    draftSetupReadinessProp !== undefined
      ? draftSetupReadinessProp
      : computeSaleDetailReadiness({
          saleId,
          sale,
          lots,
          pendingRegistrationCount: pendingRegs > 0 ? pendingRegs : null,
          ...(connectRequiredByLotId ? { connectRequiredByLotId } : {}),
        });
  const deleteBlockers =
    sale.status === "draft" || sale.status === "scheduled"
      ? [
          ...(sellingOnAtg ? ["This sale is selling on ATG. Close it on ATG first."] : []),
          ...(bundle.deleteEligibility?.blockers ?? []),
        ]
      : [];
  const setupHref =
    sale.status === "draft"
      ? saleSetupResumeHref(saleId, {
          sale,
          lots,
          pendingRegistrationCount,
          ...(connectRequiredByLotId ? { connectRequiredByLotId } : {}),
        })
      : null;
  const seller = firstBlockedSeller(lots, connectRequiredByLotId);
  const connectRequired = seller.blocked || searchParams.get("error_code") === "connect_required";

  const onConnectRequired = useCallback(
    (message: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("error_code", "connect_required");
      params.set("error", message);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );
  const afterDelete = useCallback(() => router.push("/admin/sales"), [router]);
  const saleActions = useSaleActions({ canManageSales }, { afterDelete, onConnectRequired });

  const target: SaleActionTarget = {
    id: saleId,
    title: sale.title,
    status: sale.status,
    saleroom: isSaleroom,
    canDelete: bundle.deleteEligibility?.canDelete === true,
    sellingOnAtg,
    publishBlockedReason: connectRequired
      ? "A seller's payout account is not ready"
      : saleDetailCanPublish(setupReadiness)
        ? null
        : "Finish the sale's setup first",
  };
  const lifecycle = saleActions.actionsFor(target);
  const publish = lifecycle.find((action) => action.id === "publish") ?? null;

  const [qrOpen, setQrOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  useEffect(() => setPinned(isPalettePinned("route", pathname)), [pathname]);
  const togglePin = () => {
    const entry = { kind: "route" as const, id: pathname, href: pathname, label: sale.title };
    const next = togglePalettePinned(entry);
    if (next) pushPaletteRecent(entry);
    setPinned(next);
  };

  const overflow: OverflowAction[] = [
    {
      id: "view",
      label: "View on site",
      icon: ExternalLink,
      onSelect: () => window.open(publicHref, "_blank", "noopener"),
    },
    {
      id: "qr",
      label: "Marketing QR code",
      icon: QrCode,
      onSelect: () => setQrOpen(true),
      requires: SALES_ACCESS,
    },
    ...(linkedEventSlug
      ? [
          {
            id: "event",
            label: `Open RSVP event${linkedEventTitle ? `: ${linkedEventTitle}` : ""}`,
            icon: CalendarDays,
            href: `/admin/event-rsvps/${encodeURIComponent(linkedEventSlug)}`,
          },
        ]
      : []),
    {
      id: "pin",
      label: pinned ? "Unpin from sidebar" : "Pin to sidebar",
      icon: Pin,
      onSelect: togglePin,
    },
    ...lifecycle.filter((action) => action.id !== "publish"),
  ];

  const notice = saleDetailNotice({
    status: sale.status,
    connectRequired,
    blockedSellerLegalEntityId: seller.sellerLegalEntityId,
    sellingOnAtg,
    readiness: setupReadiness,
    setupHref,
  });

  const editLink = saleEditLink({
    status: sale.status,
    canManage: canManageSales,
    liveish,
    editHref: adminSaleEditHref(saleId),
    setupHref,
    setupOpen: Boolean(setupReadiness && setupReadiness.percent < 100),
    notice,
  });
  const editButton = editLink ? (
    <StaffButton asChild variant="secondary" icon={<Pencil aria-hidden />} requires={SALES_ACCESS}>
      <Link href={editLink.href}>{editLink.label}</Link>
    </StaffButton>
  ) : null;
  const primary = publish ? (
    <StaffButton
      variant="primary"
      requires={SALES_ACCESS}
      {...(publish.disabledReason ? { disabledReason: publish.disabledReason } : {})}
      onClick={() => publish.onSelect?.()}
    >
      Publish sale
    </StaffButton>
  ) : liveish ? (
    <StaffButton asChild variant="primary" requires={SALEROOM_ACCESS}>
      <Link href={adminSaleroomHref(saleId)}>Open saleroom</Link>
    </StaffButton>
  ) : null;

  const navGroups = buildSaleDetailNav({
    saleId,
    deliveryMode: sale.deliveryMode,
    liveish,
    lotCount: lots.length,
    registrationCount,
    pendingRegistrationCount: pendingRegs,
    pendingTelephoneBookingCount: pendingTelephoneBookingCount ?? 0,
    documentCount,
    overviewAttentionCount,
    canManageSales,
  });

  return (
    <>
      <DetailPage
        breadcrumbs={
          <StaffBreadcrumbs
            Link={NextLink}
            items={[{ label: "Sales", href: "/admin/sales" }, { label: sale.title }]}
          />
        }
        title={
          <StaffEditableTitle
            value={sale.title}
            label="sale"
            editable={canManageSales}
            onSave={adminUpdateSaleTitleFieldAction.bind(null, saleId)}
          />
        }
        status={
          <>
            <StatusBadge tone={status.tone} live={status.live ?? false}>
              {status.label}
            </StatusBadge>
            {sellingOnAtg ? <StatusBadge tone="neutral">Selling on ATG</StatusBadge> : null}
          </>
        }
        meta={
          <>
            <MetaItem label="Format">{deliveryModeShortLabel(sale.deliveryMode)}</MetaItem>
            {sale.startTime ? (
              <MetaItem label="Opens">
                <StaffDate value={sale.startTime} withTime />
              </MetaItem>
            ) : null}
            {sale.endTime ? (
              <MetaItem label="Closes">
                <StaffDate value={sale.endTime} withTime />
              </MetaItem>
            ) : null}
            {venue ? <MetaItem label="Venue">{venue}</MetaItem> : null}
          </>
        }
        primaryAction={primary}
        secondaryActions={editButton}
        overflow={<OverflowMenu label="More sale actions" Link={NextLink} actions={overflow} />}
        editRequires={SALES_ACCESS}
        notice={
          notice ? (
            <Notice
              tone={notice.tone}
              title={notice.title}
              alert={notice.tone === "danger"}
              actions={
                notice.action ? (
                  <StaffButton asChild size="sm" variant="secondary">
                    <Link href={notice.action.href}>{notice.action.label}</Link>
                  </StaffButton>
                ) : null
              }
            >
              {notice.body}
            </Notice>
          ) : null
        }
        tabs={<SaleDetailSectionNav saleId={saleId} groups={navGroups} />}
      >
        <SaleDetailReadinessProvider
          draftSetupReadiness={setupReadiness}
          deleteBlockers={deleteBlockers}
          canManageSales={canManageSales}
        >
          {children}
        </SaleDetailReadinessProvider>
      </DetailPage>
      {canManageSales ? (
        <AdminQrCodeButton
          entityType="sale"
          entityId={saleId}
          title={sale.title}
          open={qrOpen}
          onOpenChange={setQrOpen}
        />
      ) : null}
      {saleActions.dialogs}
    </>
  );
}
