"use client";

import { LotDetailReadinessProvider } from "@/components/admin/lot-detail/lot-detail-readiness-context";
import { lotDetailTabHref } from "@/components/admin/lot-detail/lot-detail-types";
import { type LotActionTarget, useLotActions } from "@/components/admin/lots/use-lot-actions";
import { StaffDetailTabs } from "@/components/admin/staff/staff-detail-tabs";
import { StaffEditableTitle } from "@/components/admin/staff/staff-editable-title";
import { adminUpdateLotTitleFieldAction } from "@/lib/actions/admin/field-updates";
import {
  type CatalogReadinessResult,
  lotPublishBlockedReason,
} from "@/lib/admin/catalog-readiness";
import { computeLotDetailReadiness } from "@/lib/admin/compute-lot-detail-readiness";
import type { AdminLotDetailBundle } from "@/lib/admin/load-lot-detail";
import { lotDetailNotice, lotEditLink } from "@/lib/admin/lots/lot-detail-page.vm";
import { staffStatus } from "@/lib/admin/staff-kit-status";
import { lotAuctionTypeLabel } from "@/lib/presenters/lot-auction-type/lot-auction-type-registry";
import { lotPath } from "@/lib/seo/url";
import { notify } from "@/lib/ui/notify";
import {
  DetailPage,
  MetaItem,
  Notice,
  type OverflowAction,
  OverflowMenu,
  StaffBreadcrumbs,
  StaffButton,
  type StaffLinkComponent,
  StatusBadge,
  staffCellLinkClass,
} from "@auction/staff-ui";
import { Copy, ExternalLink, Pencil } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useCallback, useMemo } from "react";

const NextLink: StaffLinkComponent = Link;

type Props = {
  lotId: string;
  bundle: AdminLotDetailBundle;
  bidCount?: number | null;
  documentCount?: number | null;
  connectRequired?: boolean;
  canManageCatalog?: boolean;
  canManageAuction?: boolean;
  canDecideWithdrawals?: boolean;
  /** When the seller asked to withdraw the lot (ISO), while the request waits for a decision. */
  withdrawalRequestedAt?: string | null;
  publishReadiness?: CatalogReadinessResult | null;
  children: ReactNode;
};

/**
 * A lot's page on the staff record template: where it sits, what it is (title, status, key
 * facts), its next step as the one primary action, the rest in the overflow menu (destructive
 * last, each confirmed through the kit), one notice for what blocks it, and its sections as tabs.
 * The routed tab renders below, inside the readiness context the tabs share.
 */
export function LotDetailShell({
  lotId,
  bundle,
  bidCount = null,
  documentCount = null,
  connectRequired = false,
  canManageCatalog = false,
  canManageAuction = false,
  canDecideWithdrawals = false,
  withdrawalRequestedAt = null,
  publishReadiness: publishReadinessProp,
  children,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { auction, context } = bundle;
  const publicHref = lotPath({ id: auction.id, title: auction.title });
  const status = staffStatus("lot", auction.status, { lot: { winnerId: auction.winnerId } });
  const connectBlocked = connectRequired || searchParams.get("error_code") === "connect_required";
  const inDraftSale = context.sale?.status === "draft";

  const publishReadiness =
    publishReadinessProp !== undefined
      ? publishReadinessProp
      : computeLotDetailReadiness({ lotId, auction, context, connectRequired });
  const deleteBlockers =
    auction.status === "draft" || auction.status === "scheduled"
      ? (bundle.deleteEligibility?.blockers ?? [])
      : [];

  const parentSale = context.sale;
  const afterDelete = useCallback(() => {
    if (parentSale?.status === "draft" && context.parentSaleLotCount === 1) {
      notify.action("The sale has no lots now", {
        description: `${parentSale.title} is a draft with no lots left. You can delete it too.`,
        actionLabel: "Open sale",
        onAction: () => router.push(`/admin/sales/${parentSale.id}`),
      });
    }
    router.push("/admin/lots");
  }, [parentSale, context.parentSaleLotCount, router]);
  const onConnectRequired = useCallback(
    (message: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("error_code", "connect_required");
      params.set("error", message);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );
  const lotActions = useLotActions(
    { canManageCatalog, canManageAuction, canDecideWithdrawals },
    { afterDelete, onConnectRequired },
  );

  const target: LotActionTarget = {
    id: lotId,
    title: auction.title,
    status: auction.status,
    inDraftSale,
    canDelete: bundle.deleteEligibility?.canDelete === true,
    hasWinner: auction.winnerId != null,
    withdrawalRequested: withdrawalRequestedAt !== null,
    publishBlockedReason: connectBlocked
      ? "The seller's payout account is not ready"
      : publishReadiness
        ? lotPublishBlockedReason(publishReadiness)
        : null,
  };
  const stateActions = lotActions.actionsFor(target);
  const publish = stateActions.find((action) => action.id === "publish") ?? null;
  const edit = canManageCatalog ? lotEditLink(lotId, auction.status) : null;

  const overflow: OverflowAction[] = [
    {
      id: "view",
      label: "View on site",
      icon: ExternalLink,
      onSelect: () => window.open(publicHref, "_blank", "noopener"),
    },
    ...(canManageCatalog
      ? [
          {
            id: "duplicate",
            label: "Duplicate as draft",
            icon: Copy,
            href: `/admin/lots/new?fromLot=${encodeURIComponent(lotId)}`,
          },
        ]
      : []),
    ...stateActions.filter((action) => action.id !== "publish"),
  ];

  const notice = useMemo(
    () =>
      lotDetailNotice({
        lotId,
        status: auction.status,
        connectRequired: connectBlocked,
        sellerLegalEntityId: auction.sellerLegalEntityId ?? null,
        inDraftSale,
        readiness: publishReadiness,
        canManageCatalog,
        withdrawalRequestedAt,
      }),
    [
      withdrawalRequestedAt,
      lotId,
      auction.status,
      connectBlocked,
      auction.sellerLegalEntityId,
      inDraftSale,
      publishReadiness,
      canManageCatalog,
    ],
  );

  const canEditTitle =
    canManageCatalog &&
    (auction.status === "draft" || auction.status === "scheduled" || auction.status === "active");
  const catalogIncomplete =
    auction.status === "draft" && (auction.images.length === 0 || !auction.description?.trim());

  const editButton = edit ? (
    <StaffButton asChild variant={publish ? "secondary" : "primary"} icon={<Pencil aria-hidden />}>
      <Link href={edit.href}>{edit.label}</Link>
    </StaffButton>
  ) : null;
  const publishButton = publish ? (
    <StaffButton
      variant="primary"
      {...(publish.disabledReason ? { disabledReason: publish.disabledReason } : {})}
      onClick={() => publish.onSelect?.()}
    >
      Publish lot
    </StaffButton>
  ) : null;

  return (
    <>
      <DetailPage
        breadcrumbs={
          <StaffBreadcrumbs
            Link={NextLink}
            items={[
              { label: "Lots", href: "/admin/lots" },
              ...(context.sale
                ? [{ label: context.sale.title, href: `/admin/sales/${context.sale.id}` }]
                : []),
              { label: auction.title },
            ]}
          />
        }
        title={
          <StaffEditableTitle
            value={auction.title}
            label="lot"
            editable={canEditTitle}
            onSave={adminUpdateLotTitleFieldAction.bind(null, lotId)}
          />
        }
        status={
          <StatusBadge tone={status.tone} live={status.live ?? false}>
            {status.label}
          </StatusBadge>
        }
        meta={
          <>
            {auction.lotNumber != null ? (
              <MetaItem label="Lot">{auction.lotNumber}</MetaItem>
            ) : null}
            {context.sale ? (
              <MetaItem label="Sale">
                <Link href={`/admin/sales/${context.sale.id}`} className={staffCellLinkClass}>
                  {context.sale.title}
                </Link>
              </MetaItem>
            ) : (
              <MetaItem label="Sale">Not in a sale</MetaItem>
            )}
            {context.artist ? (
              <MetaItem label="Artist">
                <Link href={`/admin/artists/${context.artist.id}`} className={staffCellLinkClass}>
                  {context.artist.displayName}
                </Link>
              </MetaItem>
            ) : null}
            <MetaItem label="Type">{lotAuctionTypeLabel(auction.auctionType)}</MetaItem>
          </>
        }
        primaryAction={publishButton ?? editButton}
        secondaryActions={publishButton ? editButton : null}
        overflow={<OverflowMenu label="More lot actions" Link={NextLink} actions={overflow} />}
        access={canManageCatalog || canManageAuction ? "full" : "read-only"}
        roleLabel="Catalogue"
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
        tabs={
          <StaffDetailTabs
            label="Lot sections"
            items={[
              { id: "overview", label: "Overview", href: lotDetailTabHref(lotId, "overview") },
              {
                id: "images",
                label: catalogIncomplete ? "Media · needs work" : "Media",
                href: lotDetailTabHref(lotId, "images"),
                count: auction.images.length,
              },
              {
                id: "documents",
                label: "Documents",
                href: lotDetailTabHref(lotId, "documents"),
                count: documentCount ?? 0,
              },
              {
                id: "bids",
                label: "Bidding",
                href: lotDetailTabHref(lotId, "bids"),
                count: bidCount ?? 0,
              },
              { id: "activity", label: "Activity", href: lotDetailTabHref(lotId, "activity") },
            ]}
          />
        }
      >
        <LotDetailReadinessProvider
          publishReadiness={publishReadiness}
          deleteBlockers={deleteBlockers}
          canManageAuction={canManageAuction}
        >
          {children}
        </LotDetailReadinessProvider>
      </DetailPage>
      {lotActions.dialogs}
    </>
  );
}
