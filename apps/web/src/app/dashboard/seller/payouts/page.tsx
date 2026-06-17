import { DashboardListPage } from "@/components/dashboard/dashboard-list-page";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import {
  PayoutsDesktopList,
  PayoutsMobileList,
} from "@/components/dashboard/list/payouts-mobile-list";
import { DashboardEmptyState } from "@/components/dashboard/primitives";
import {
  SellerOrgContextBanner,
  SellerProfileUnavailableAlert,
} from "@/components/dashboard/seller-org-context-banner";
import { ExportButton } from "@/components/exports/export-button";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import {
  legalEntityToConnectFields,
  resolveSellerConnectPresentation,
} from "@/lib/connect/resolve-seller-connect-presentation";
import {
  loadSellerComplianceChrome,
  shouldShowConnectPageAlert,
} from "@/lib/connect/seller-compliance-chrome.server";
import { DASHBOARD_CTA, DASHBOARD_EMPTY, DASHBOARD_ROUTES } from "@/lib/dashboard/dashboard-copy";
import {
  buildSellerPayoutFailure,
  buildSellerPayoutPreviewFailure,
} from "@/lib/dashboard/dashboard-fetch-errors";
import { getServerDataContainer } from "@/lib/data/container.server";
import type { SellerPayoutPendingPreview } from "@/lib/data/http/seller-payouts.server";
import { getServerStripeConnectClientConfig } from "@/lib/data/http/stripe-connect.server";
import { createOrganisationHubGateway } from "@/lib/legal-entity/organisation-hub.gateway.server";
import { resolveSellerWorkspaceContext } from "@/lib/legal-entity/seller-acting-context.server";
import { formatMoney } from "@/lib/ui/format";
import { readClientWorkspacePageMeta } from "@/lib/workspace/client-workspace-mode";
import type { Payout } from "@auction/types";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { Surface } from "@auction/ui/components/surface";
import { WalletCards } from "lucide-react";
import Link from "next/link";

export default async function SellerPayoutsPage() {
  const user = await requireAuthenticatedUser({
    shell: "client",
    loginNext: DASHBOARD_ROUTES.sellerPayouts,
  });
  const sellerCtx = await resolveSellerWorkspaceContext(user.role, user.staffRole ?? null);
  const { sellerEntityId, orgActingSelected, bootstrapFailed } = sellerCtx;

  const complianceChrome = await loadSellerComplianceChrome(user.id);

  const c = await getServerDataContainer();
  let payouts: Payout[] = [];
  let listFailure = null;
  let previewFailure = null;
  let preview: SellerPayoutPendingPreview | null = null;
  let connectPresentation = resolveSellerConnectPresentation({
    connectEnforced: false,
    entity: null,
  });

  if (sellerEntityId) {
    const hub = createOrganisationHubGateway();
    const [listRes, previewRes, clientConfig, entity] = await Promise.all([
      c.sellerPayouts.listForLegalEntity(sellerEntityId),
      c.sellerPayouts.previewNextForLegalEntity(sellerEntityId),
      getServerStripeConnectClientConfig(),
      hub.getEntityDetail(sellerEntityId).catch(() => null),
    ]);
    if (listRes.ok) {
      payouts = listRes.payouts;
    } else {
      listFailure = buildSellerPayoutFailure(listRes.error);
    }
    if (previewRes.ok) {
      preview = previewRes.data;
    } else {
      previewFailure = buildSellerPayoutPreviewFailure(previewRes.error);
    }
    connectPresentation = resolveSellerConnectPresentation({
      connectEnforced: clientConfig.connectEnforced,
      entity: entity ? legalEntityToConnectFields(entity) : null,
    });
  }

  const workspaceMeta = await readClientWorkspacePageMeta();

  const showConnectAlert = shouldShowConnectPageAlert(complianceChrome, connectPresentation);
  const connectBanner =
    showConnectAlert && connectPresentation.bannerCopy ? (
      <Alert>
        <AlertTitle>{connectPresentation.bannerCopy.title}</AlertTitle>
        <AlertDescription className="flex flex-wrap items-center gap-3">
          <span>{connectPresentation.bannerCopy.description}</span>
          <Button asChild variant="cta" size="sm">
            <Link href={DASHBOARD_ROUTES.sellerConnect}>{DASHBOARD_CTA.openPayoutSetup}</Link>
          </Button>
        </AlertDescription>
      </Alert>
    ) : null;

  const orgBanner = orgActingSelected ? <SellerOrgContextBanner /> : null;
  const profileBanner = !sellerEntityId ? (
    <SellerProfileUnavailableAlert bootstrapFailed={bootstrapFailed} />
  ) : null;

  return (
    <DashboardListPage
      meta={workspaceMeta}
      title="Sold & payouts"
      description="Hammer prices, buyer premiums collected by LAX, seller commissions, and adjustments roll into each settlement batch."
      banner={
        <>
          {orgBanner}
          {profileBanner}
          {connectBanner}
        </>
      }
      errorAlert={
        <>
          {listFailure ? <DashboardSliceErrorAlert failure={listFailure} /> : null}
          {previewFailure ? <DashboardSliceErrorAlert failure={previewFailure} /> : null}
        </>
      }
      actions={
        payouts.length > 0 && sellerEntityId ? (
          <ExportButton
            entityType="payouts"
            label="Export CSV"
            filters={{ legalEntityId: sellerEntityId }}
          />
        ) : null
      }
    >
      {preview ? (
        <Surface variant="section" padding="md" className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-on-surface-variant">
            Next payout (preview)
          </h2>
          {preview.paymentCount === 0 ? (
            <p className="text-sm text-on-surface-variant">
              No captured payments are awaiting settlement.
            </p>
          ) : (
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-on-surface-variant">Gross</dt>
                <dd className="font-medium tabular-nums text-on-surface">
                  {formatMoney(preview.pendingGross, preview.currency)}
                </dd>
              </div>
              <div>
                <dt className="text-on-surface-variant">Platform fees</dt>
                <dd className="font-medium tabular-nums text-on-surface">
                  {formatMoney(preview.pendingPlatformFee, preview.currency)}
                </dd>
              </div>
              <div>
                <dt className="text-on-surface-variant">Net</dt>
                <dd className="font-semibold tabular-nums text-on-surface">
                  {formatMoney(preview.pendingNet, preview.currency)}
                </dd>
              </div>
              <div className="sm:col-span-3">
                <p className="text-xs text-on-surface-variant">
                  Across {preview.paymentCount} captured payment
                  {preview.paymentCount === 1 ? "" : "s"}. Net excludes Stripe transfer fees, which
                  are reconciled when the payout is initiated.
                </p>
              </div>
            </dl>
          )}
        </Surface>
      ) : null}

      {payouts.length === 0 && !listFailure ? (
        <DashboardEmptyState
          variant="hero"
          icon={<WalletCards aria-hidden />}
          title={DASHBOARD_EMPTY.sellerPayouts.title}
          description={DASHBOARD_EMPTY.sellerPayouts.description}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {!connectPresentation.connectReady ? (
                <Button variant="primary" asChild>
                  <Link href={DASHBOARD_ROUTES.sellerConnect}>{DASHBOARD_CTA.openPayoutSetup}</Link>
                </Button>
              ) : null}
              <Button
                variant={connectPresentation.connectReady ? "primary" : "secondaryOutline"}
                asChild
              >
                <Link href={DASHBOARD_ROUTES.sellerInSale}>{DASHBOARD_CTA.itemsInSale}</Link>
              </Button>
              <Button variant="secondaryOutline" asChild>
                <Link href={DASHBOARD_ROUTES.submissionsNew}>{DASHBOARD_CTA.newSubmission}</Link>
              </Button>
            </div>
          }
        />
      ) : payouts.length > 0 && sellerEntityId ? (
        <>
          <PayoutsMobileList payouts={payouts} sellerEntityId={sellerEntityId} />
          <PayoutsDesktopList payouts={payouts} sellerEntityId={sellerEntityId} />
        </>
      ) : null}
    </DashboardListPage>
  );
}
