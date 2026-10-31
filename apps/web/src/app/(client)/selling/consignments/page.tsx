import { DashboardListPage } from "@/components/dashboard/dashboard-list-page";
import { SellerProfileUnavailableAlert } from "@/components/dashboard/seller-profile-unavailable-alert";
import { ConsignmentsExportButton } from "@/components/dashboard/seller/consignments-export-button";
import { ConsignmentsView } from "@/components/dashboard/seller/consignments-view";
import { SubmissionsListAutoRefresh } from "@/components/dashboard/submissions/submissions-list-auto-refresh";
import { SetMobileShellTitle } from "@/components/layout/set-mobile-shell-title";
import { WorkspacePageNoAccess } from "@/components/organisations/workspace-page-no-access";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { resolveSellerWorkspaceContext } from "@/lib/legal-entity/seller-acting-context.server";
import { SELL_A_WORK_LABEL } from "@/lib/marketing/sell-flow-copy";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { workspacePageRefusal } from "@/lib/presenters/workspace-access/workspace-access";
import { defaultConsignmentView, parseConsignmentsListQuery } from "@/lib/seller/consignments-list";
import { loadConsignments } from "@/lib/seller/consignments.server";
import { sellingAccess } from "@/lib/seller/selling-access.server";
import { ButtonLink } from "@auction/ui/lax";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

const PATH = CLIENT_ROUTES.consignments;

export const metadata: Metadata = { title: "Consignments" };

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Consignments: the works the account has sent to sell, from review to sale, with what waits on
 * the member first. A person sees their own; an organisation's members see what their role
 * allows (a consignor, their own).
 */
export default async function SellerConsignmentsPage({ searchParams }: PageProps) {
  const user = await requireAuthenticatedUser({ shell: "client", loginNext: PATH });
  const sellerCtx = await resolveSellerWorkspaceContext(user.role, user.staffRoles);
  const refusal = workspacePageRefusal(PATH, sellerCtx.actor);
  if (refusal) {
    return (
      <>
        <SetMobileShellTitle title={refusal.label} />
        <WorkspacePageNoAccess label={refusal.label} openedBy={refusal.openedBy} next={PATH} />
      </>
    );
  }
  const access = sellingAccess(sellerCtx);
  const [{ records, truncated }, sp] = await Promise.all([
    loadConsignments(sellerCtx, user.id),
    searchParams,
  ]);
  const fallbackView = records ? defaultConsignmentView(records) : "all";
  const query = parseConsignmentsListQuery(sp, fallbackView);
  const hasAny = Boolean(records && records.length > 0);

  return (
    <DashboardListPage
      title="Consignments"
      description={
        access.organisation
          ? `Works ${access.organisation} has sent us to sell, from review to sale.`
          : "Works you've sent us to sell, from review to sale."
      }
      banner={sellerCtx.sellerEntityId ? null : <SellerProfileUnavailableAlert />}
      actions={
        hasAny ? (
          <>
            <ConsignmentsExportButton records={records ?? []} fallbackView={fallbackView} />
            {access.canSell ? (
              <ButtonLink
                href={CLIENT_ROUTES.sellingNew}
                Link={Link}
                variant="primary"
                icon={<Plus aria-hidden />}
              >
                {SELL_A_WORK_LABEL}
              </ButtonLink>
            ) : null}
          </>
        ) : null
      }
    >
      <SetMobileShellTitle title="Consignments" />
      <SubmissionsListAutoRefresh
        enabled={Boolean(records?.some((record) => record.status === "in_review"))}
      />
      <ConsignmentsView
        records={records}
        query={query}
        organisation={access.organisation}
        canSell={access.canSell}
        pausedReason={access.pausedReason}
        truncated={truncated}
      />
    </DashboardListPage>
  );
}
