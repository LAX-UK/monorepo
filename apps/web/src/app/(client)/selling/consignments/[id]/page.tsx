import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { AccountLoadError } from "@/components/dashboard/primitives/account-load-error";
import { ConsignmentDetailHead } from "@/components/dashboard/seller/consignment-detail-parts";
import { ConsignmentDetailTabs } from "@/components/dashboard/seller/consignment-detail-tabs";
import { SubmissionDetailLiveRefresh } from "@/components/dashboard/submission-detail-live-refresh";
import { ClientFlashNotice } from "@/components/flash/client-flash-notice";
import { AccountRestoreHop } from "@/components/layout/account-switcher/account-restore-hop";
import { SetMobileShellTitle } from "@/components/layout/set-mobile-shell-title";
import { WorkspacePageNoAccess } from "@/components/organisations/workspace-page-no-access";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { ACCOUNT_LOAD_ERROR } from "@/lib/dashboard/dashboard-copy";
import { resolveSellerWorkspaceContext } from "@/lib/legal-entity/seller-acting-context.server";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { workspacePageRefusal } from "@/lib/presenters/workspace-access/workspace-access";
import {
  consignmentDetailTab,
  consignmentDetailTabItems,
} from "@/lib/seller/consignment-detail-tabs";
import { consignmentHref } from "@/lib/seller/consignment-records";
import { StatusBadge } from "@auction/ui/lax/status-badge";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ConsignmentAside,
  ConsignmentNextStepNotice,
  ConsignmentTabBody,
} from "./consignment-detail-sections";
import { loadConsignmentDetail } from "./consignment-detail.server";

export const metadata: Metadata = { title: "Consignment" };

export default async function SubmissionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const tab = consignmentDetailTab(sp.tab);
  const user = await requireAuthenticatedUser({
    shell: "client",
    loginNext: `/selling/consignments/${id}`,
  });
  const sellerCtx = await resolveSellerWorkspaceContext(user.role, user.staffRoles);
  // A role that does not follow consignments gets the access page, not a page that claims the
  // consignment does not exist.
  const refusal = workspacePageRefusal(CLIENT_ROUTES.consignments, sellerCtx.actor);
  if (refusal) {
    return (
      <>
        <SetMobileShellTitle title="Consignment" />
        <WorkspacePageNoAccess
          label={refusal.label}
          openedBy={refusal.openedBy}
          next={consignmentHref(id)}
        />
      </>
    );
  }

  const loaded = await loadConsignmentDetail({ id, tab, user, sellerCtx });
  if (loaded.kind === "hop") return <AccountRestoreHop href={loaded.href} />;
  if (loaded.kind === "notFound") notFound();
  if (loaded.kind === "loadFailure") {
    return (
      <DashboardPage className="space-y-8">
        <SetMobileShellTitle title="Consignment" />
        <AccountLoadError {...ACCOUNT_LOAD_ERROR.consignment} />
      </DashboardPage>
    );
  }

  const { vm } = loaded;
  const { submission, statusView, thread } = vm;
  return (
    <DashboardPage className="space-y-8">
      <SetMobileShellTitle title={submission.title} />
      <ConsignmentDetailHead
        vm={vm.detail}
        facts={vm.headFacts}
        title={submission.title}
        status={
          <StatusBadge
            tone={statusView.tone}
            shape={statusView.shape}
            live={statusView.live ?? false}
          >
            {statusView.label}
          </StatusBadge>
        }
      />
      <ClientFlashNotice path={consignmentHref(id)} />
      {tab === "overview" ? <SubmissionDetailLiveRefresh status={submission.status} /> : null}
      <ConsignmentNextStepNotice vm={vm} />
      <ConsignmentDetailTabs
        activeId={tab}
        items={consignmentDetailTabItems({
          submissionId: submission.id,
          // Unread counts in ink only for the people who answer; others see how many there are.
          messages: thread
            ? {
                total: thread.messages.length,
                unread: thread.access.canWrite ? thread.unread : 0,
              }
            : null,
          documents: vm.documentsCount,
        })}
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <ConsignmentTabBody vm={vm} />
        <ConsignmentAside vm={vm} />
      </div>
    </DashboardPage>
  );
}
