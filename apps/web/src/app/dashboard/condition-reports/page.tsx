import { ConditionReportsBoard } from "@/components/dashboard/condition-reports/condition-reports-board";
import { DashboardListPage } from "@/components/dashboard/dashboard-list-page";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { mapBuyerConditionReportRequestsVM } from "@/lib/condition-report/map-buyer-condition-report-requests.vm";
import { describeDashboardSliceFailure } from "@/lib/dashboard/dashboard-fetch-errors";
import { getServerMyConditionReportRequests } from "@/lib/data/http/condition-report.server";
import { readClientWorkspacePageMeta } from "@/lib/workspace/client-workspace-mode";

export default async function DashboardConditionReportsPage() {
  const workspaceMeta = await readClientWorkspacePageMeta();

  let rows: ReturnType<typeof mapBuyerConditionReportRequestsVM> = [];
  let loadFailure: ReturnType<typeof describeDashboardSliceFailure> | null = null;

  try {
    const result = await getServerMyConditionReportRequests(50, 0);
    rows = mapBuyerConditionReportRequestsVM(result.items);
  } catch (e) {
    loadFailure = describeDashboardSliceFailure(
      e,
      "conditionReports",
      "Could not load your condition report requests.",
    );
  }

  return (
    <DashboardListPage
      meta={workspaceMeta}
      title="Condition reports"
      description="Track specialist condition report requests and download PDFs when they are ready."
    >
      {loadFailure ? (
        <DashboardSliceErrorAlert failure={loadFailure} />
      ) : (
        <ConditionReportsBoard rows={rows} />
      )}
    </DashboardListPage>
  );
}
