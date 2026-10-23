import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import { SellerProfileUnavailableAlert } from "@/components/dashboard/seller-profile-unavailable-alert";
import { SellerAttentionList } from "@/components/dashboard/seller/seller-attention-list";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import {
  legalEntityToConnectFields,
  resolveSellerConnectPresentation,
} from "@/lib/connect/resolve-seller-connect-presentation";
import { DASHBOARD_CTA, DASHBOARD_ROUTES } from "@/lib/dashboard/dashboard-copy";
import {
  type DashboardSliceFailure,
  describeDashboardSliceFailure,
} from "@/lib/dashboard/dashboard-fetch-errors";
import { getServerDataContainer } from "@/lib/data/container.server";
import { getServerStripeConnectClientConfig } from "@/lib/data/http/stripe-connect.server";
import { createOrganisationHubGateway } from "@/lib/legal-entity/organisation-hub.gateway.server";
import {
  resolveSellerWorkspaceContext,
  sellerCan,
} from "@/lib/legal-entity/seller-acting-context.server";
import { submissionsFailureFromCaught } from "@/lib/legal-entity/submissions-access-errors";
import { ORG_SETTINGS_PATH } from "@/lib/navigation/client-nav-model";
import { buildSellerAttentionItems } from "@/lib/seller/seller-attention";
import type { ItemSubmission, Lot } from "@auction/types";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { Plus } from "lucide-react";
import Link from "next/link";

const PAGE_LIMIT = 100;

/** Where payout setup lives for the account being sold as. */
function payoutSetupHref(sellerEntityId: string | null, sellingAsOrganisation: boolean): string {
  return sellingAsOrganisation && sellerEntityId
    ? `${ORG_SETTINGS_PATH}/${sellerEntityId}/connect`
    : DASHBOARD_ROUTES.sellerConnect;
}

export default async function SellerOverviewPage() {
  const user = await requireAuthenticatedUser({ shell: "client", loginNext: "/dashboard/seller" });
  const sellerCtx = await resolveSellerWorkspaceContext(user.role, user.staffRole ?? null);
  const { sellerEntityId, sellingAsOrganisation, bootstrapFailed } = sellerCtx;
  const canSell = sellerCan(sellerCtx, "entity.consignments.read");
  const canCreateSubmission = sellerCan(sellerCtx, "entity.submissions.create");

  const failures: DashboardSliceFailure[] = [];
  let submissions: ItemSubmission[] = [];
  let lots: Lot[] = [];
  let payoutSetupIncomplete = false;
  let identityVerificationNeeded = false;

  if (canSell && sellerEntityId) {
    const c = await getServerDataContainer();
    const hub = createOrganisationHubGateway();
    const [submissionsResult, lotsResult, clientConfig, entity, kyc] = await Promise.all([
      c.submissions.listMine({ limit: PAGE_LIMIT, offset: 0 }).then(
        (value) => ({ ok: true as const, value }),
        (reason: unknown) => ({ ok: false as const, reason }),
      ),
      c.sellerLots.list({ sellerId: sellerEntityId, limit: PAGE_LIMIT }).then(
        (value) => ({ ok: true as const, value }),
        (reason: unknown) => ({ ok: false as const, reason }),
      ),
      getServerStripeConnectClientConfig(),
      hub.getEntityDetail(sellerEntityId).catch(() => null),
      c.kyc.getSummary().catch(() => null),
    ]);

    if (submissionsResult.ok) submissions = submissionsResult.value;
    else failures.push(submissionsFailureFromCaught(submissionsResult.reason));
    if (lotsResult.ok) lots = lotsResult.value;
    else {
      failures.push(
        describeDashboardSliceFailure(lotsResult.reason, "sellerLots", "Could not load your lots."),
      );
    }

    payoutSetupIncomplete = resolveSellerConnectPresentation({
      connectEnforced: clientConfig.connectEnforced,
      entity: entity ? legalEntityToConnectFields(entity) : null,
    }).showBanner;
    // Identity checks belong to a person; an organisation is checked through its documents.
    identityVerificationNeeded =
      !sellingAsOrganisation &&
      kyc !== null &&
      kyc.status !== "approved" &&
      (kyc.requiresKyc || payoutSetupIncomplete);
  }

  const loadedNothing = failures.length === 2;
  const attention = buildSellerAttentionItems({
    submissions,
    lots,
    payoutSetupIncomplete,
    identityVerificationNeeded,
    payoutSetupHref: payoutSetupHref(sellerEntityId, sellingAsOrganisation),
    canOpenPayoutSetup: sellerCan(sellerCtx, "entity.connect.operate"),
    now: new Date(),
  });

  return (
    <DashboardPage className="space-y-8">
      <DashboardPageHeader
        title="Overview"
        hideTitleOnMobile
        hideDescriptionOnMobile
        description="What needs you today, and where to find the rest."
        actions={
          canCreateSubmission ? (
            <Button variant="primary" asChild>
              <Link href={DASHBOARD_ROUTES.submissionsNew}>
                <Plus className="size-4" aria-hidden />
                {DASHBOARD_CTA.newSubmission}
              </Link>
            </Button>
          ) : null
        }
      />

      {!sellerEntityId ? <SellerProfileUnavailableAlert bootstrapFailed={bootstrapFailed} /> : null}
      {failures.map((failure) => (
        <DashboardSliceErrorAlert key={failure.title} failure={failure} />
      ))}

      {!canSell ? (
        <Alert>
          <AlertTitle>No selling pages for your role</AlertTitle>
          <AlertDescription>
            Your role in this organisation does not include consignments. Ask an owner or admin if
            you need access.
          </AlertDescription>
        </Alert>
      ) : loadedNothing ? null : (
        <SellerAttentionList items={attention} />
      )}
    </DashboardPage>
  );
}
