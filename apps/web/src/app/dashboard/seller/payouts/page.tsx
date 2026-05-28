import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import {
  PayoutsDesktopList,
  PayoutsMobileList,
} from "@/components/dashboard/list/payouts-mobile-list";
import { ExportButton } from "@/components/exports/export-button";
import { DashboardEmptyState } from "@/components/dashboard/primitives";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import {
  SellerOrgContextBanner,
  SellerProfileUnavailableAlert,
} from "@/components/dashboard/seller-org-context-banner";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { DASHBOARD_CTA, DASHBOARD_EMPTY, DASHBOARD_ROUTES } from "@/lib/dashboard/dashboard-copy";
import { buildSellerPayoutFailure } from "@/lib/dashboard/dashboard-fetch-errors";
import { getServerDataContainer } from "@/lib/data/container.server";
import type { SellerPayoutPendingPreview } from "@/lib/data/http/seller-payouts.server";
import { getServerStripeConnectClientConfig } from "@/lib/data/http/stripe-connect.server";
import { createOrganisationHubGateway } from "@/lib/legal-entity/organisation-hub.gateway.server";
import { resolveSellerWorkspaceContext } from "@/lib/legal-entity/seller-acting-context.server";
import { readClientWorkspacePageMeta } from "@/lib/workspace/client-workspace-mode";
import { isSellerConnectReady } from "@auction/connect";
import type { Payout } from "@auction/types";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { Surface } from "@auction/ui/components/surface";
import { WalletCards } from "lucide-react";
import Link from "next/link";

function formatMoney(amount: string, currency: string): string {
  const value = Number.parseFloat(amount);
  if (Number.isNaN(value)) return `${amount} ${currency}`;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(value);
}

export default async function SellerPayoutsPage() {
  const user = await requireAuthenticatedUser({
    shell: "client",
    loginNext: "/dashboard/seller/payouts",
  });
  const sellerCtx = await resolveSellerWorkspaceContext(user.role, user.staffRole ?? null);
  const { sellerEntityId, orgActingSelected, bootstrapFailed } = sellerCtx;

  const c = await getServerDataContainer();
  let payouts: Payout[] = [];
  let listFailure = null;
  let preview: SellerPayoutPendingPreview | null = null;
  let showConnectBanner = false;

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
    }
    if (
      clientConfig.connectEnforced &&
      entity &&
      !isSellerConnectReady({ ...entity, status: entity.status })
    ) {
      showConnectBanner = true;
    }
  }

  const workspaceMeta = await readClientWorkspacePageMeta();

  return (
    <DashboardPage>
      <DashboardPageHeader
        meta={workspaceMeta}
        title="Sold & payouts"
        hideTitleOnMobile
        hideDescriptionOnMobile
        description="Hammer prices, buyer premiums collected by LAX, seller commissions, and adjustments roll into each settlement batch."
        actions={
          payouts.length > 0 && sellerEntityId ? (
            <ExportButton
              entityType="payouts"
              label="Export CSV"
              filters={{ legalEntityId: sellerEntityId }}
            />
          ) : null
        }
      />

      {orgActingSelected ? <SellerOrgContextBanner /> : null}
      {!sellerEntityId ? <SellerProfileUnavailableAlert bootstrapFailed={bootstrapFailed} /> : null}

      {showConnectBanner ? (
        <Alert>
          <AlertTitle>Payout setup incomplete</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>Finish Stripe Connect verification to receive settlement transfers.</span>
            <Button asChild variant="cta" size="sm">
              <Link href="/dashboard/seller/connect">Open payout setup</Link>
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {listFailure ? <DashboardSliceErrorAlert failure={listFailure} /> : null}

      {preview && (
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
      )}

      {payouts.length === 0 && !listFailure ? (
        <DashboardEmptyState
          variant="hero"
          icon={<WalletCards aria-hidden />}
          title={DASHBOARD_EMPTY.sellerPayouts.title}
          description={DASHBOARD_EMPTY.sellerPayouts.description}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="primary" asChild>
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
    </DashboardPage>
  );
}
