import { DashboardListPage } from "@/components/dashboard/dashboard-list-page";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { AccountLoadError } from "@/components/dashboard/primitives/account-load-error";
import { DashboardEmptyState } from "@/components/dashboard/primitives/dashboard-empty-state";
import { SellerProfileUnavailableAlert } from "@/components/dashboard/seller-profile-unavailable-alert";
import { NeedsYouCard } from "@/components/dashboard/seller/needs-you-card";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import {
  ACCOUNT_LOAD_ERROR,
  DASHBOARD_CTA,
  DASHBOARD_ROUTES,
} from "@/lib/dashboard/dashboard-copy";
import {
  resolveSellerWorkspaceContext,
  sellerCan,
} from "@/lib/legal-entity/seller-acting-context.server";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { loadSellingOverview } from "@/lib/seller/selling-overview.server";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Selling" };

/**
 * An organisation's Selling overview: what needs the team, with Consignments and Sold & payouts
 * in the sidebar. A person's Selling opens on Consignments, which carries the same "Needs you".
 */
export default async function SellerOverviewPage() {
  const user = await requireAuthenticatedUser({ shell: "client", loginNext: "/selling" });
  const sellerCtx = await resolveSellerWorkspaceContext(user.role, user.staffRoles);
  if (!sellerCtx.sellingAsOrganisation) redirect(CLIENT_ROUTES.consignments);

  const { sellerEntityId, bootstrapFailed } = sellerCtx;
  const canSell = sellerCan(sellerCtx, "entity.consignments.read");
  const canCreateSubmission = sellerCan(sellerCtx, "entity.submissions.create");
  const overview = await loadSellingOverview(sellerCtx, user.id);

  return (
    <DashboardListPage
      title="Selling"
      description="What needs the team today, and where to find the rest."
      actions={
        canCreateSubmission ? (
          <Button variant="primary" size="default" asChild>
            <Link href={DASHBOARD_ROUTES.submissionsNew}>
              <Plus aria-hidden />
              {DASHBOARD_CTA.submitWork}
            </Link>
          </Button>
        ) : null
      }
      banner={
        !sellerEntityId ? <SellerProfileUnavailableAlert bootstrapFailed={bootstrapFailed} /> : null
      }
      errorAlert={
        overview.loadedNothing
          ? null
          : overview.failures.map((failure) => (
              <DashboardSliceErrorAlert key={failure.title} failure={failure} />
            ))
      }
    >
      {!canSell ? (
        <Alert>
          <AlertTitle>No selling pages for your role</AlertTitle>
          <AlertDescription>
            Your role in this organisation does not include consignments. Ask an owner or admin if
            you need access.
          </AlertDescription>
        </Alert>
      ) : overview.loadedNothing ? (
        <AccountLoadError {...ACCOUNT_LOAD_ERROR.consignments} />
      ) : overview.needsYou ? (
        <NeedsYouCard vm={overview.needsYou} />
      ) : (
        <DashboardEmptyState
          illustration="easel"
          title="Nothing needs the team"
          description="New tasks appear here when a specialist replies or a lot closes."
          action={
            <Button variant="secondaryOutline" asChild>
              <Link href={CLIENT_ROUTES.consignments}>See consignments</Link>
            </Button>
          }
        />
      )}
    </DashboardListPage>
  );
}
