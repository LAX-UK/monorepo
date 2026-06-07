import { CatalogPagination } from "@/components/admin/catalog/catalog-pagination";
import { DashboardListPage } from "@/components/dashboard/dashboard-list-page";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { DashboardSkeleton } from "@/components/dashboard/primitives";
import { SellerOrgContextBanner } from "@/components/dashboard/seller-org-context-banner";
import { SubmissionsBoard } from "@/components/dashboard/submissions-board";
import { SubmissionsListAutoRefresh } from "@/components/dashboard/submissions/submissions-list-auto-refresh";
import { SetMobileShellTitle } from "@/components/layout/set-mobile-shell-title";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { DASHBOARD_CTA, DASHBOARD_ROUTES } from "@/lib/dashboard/dashboard-copy";
import {
  type DashboardSliceFailure,
  describeSettingsActionError,
} from "@/lib/dashboard/dashboard-fetch-errors";
import {
  buildSubmissionsHref,
  parseSubmissionsParams,
} from "@/lib/dashboard/filters/submissions/submissions-filters";
import { getServerDataContainer } from "@/lib/data/container.server";
import { resolveSellerWorkspaceContext } from "@/lib/legal-entity/seller-acting-context.server";
import { submissionsFailureFromCaught } from "@/lib/legal-entity/submissions-access-errors";
import { readClientWorkspacePageMeta } from "@/lib/workspace/client-workspace-mode";
import type { ItemSubmissionStatus } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

const PAGE_SIZE = 25;

function parseOffset(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "0", 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export default async function DashboardSubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string; q?: string; offset?: string }>;
}) {
  const sp = await searchParams;
  const error = sp.error ? decodeURIComponent(sp.error) : null;
  const offset = parseOffset(sp.offset);
  const user = await requireAuthenticatedUser({
    shell: "client",
    loginNext: "/dashboard/submissions",
  });
  const { orgActingSelected } = await resolveSellerWorkspaceContext(
    user.role,
    user.staffRole ?? null,
  );
  const filters = parseSubmissionsParams(sp);
  const initialQ = filters.q;
  const initialStatus = filters.status;

  const c = await getServerDataContainer();
  let rows: Awaited<ReturnType<typeof c.submissions.listMinePaged>>["rows"] = [];
  let total = 0;
  let statusCounts: Record<ItemSubmissionStatus | "all", number> = {
    all: 0,
    draft: 0,
    submitted: 0,
    under_review: 0,
    approved: 0,
    rejected: 0,
    withdrawn: 0,
    converted: 0,
  };
  let loadFailure: DashboardSliceFailure | null = null;
  try {
    const [page, summary] = await Promise.all([
      c.submissions.listMinePaged({
        ...(initialStatus !== "all" ? { status: initialStatus } : {}),
        ...(initialQ ? { q: initialQ } : {}),
        limit: PAGE_SIZE,
        offset,
      }),
      c.submissions.getSummary(),
    ]);
    rows = page.rows;
    total = page.total;
    statusCounts = { all: summary.total, ...summary.counts };
  } catch (e) {
    loadFailure = submissionsFailureFromCaught(e);
  }

  const queryFailure = error ? describeSettingsActionError(error) : null;
  const mapped = rows.map((s) => ({
    id: s.id,
    title: s.title,
    status: s.status,
    updatedAt: s.updatedAt.toISOString(),
  }));

  const hasBlockingError = Boolean(queryFailure || loadFailure);
  const workspaceMeta = await readClientWorkspacePageMeta();
  const listFilters = { status: initialStatus, q: initialQ };
  const baseHref = buildSubmissionsHref(listFilters, {});
  const pageSep = baseHref.includes("?") ? "&" : "?";
  const prevLink =
    offset > 0 ? `${baseHref}${pageSep}offset=${Math.max(0, offset - PAGE_SIZE)}` : null;
  const nextLink =
    offset + PAGE_SIZE < total ? `${baseHref}${pageSep}offset=${offset + PAGE_SIZE}` : null;

  return (
    <DashboardListPage
      meta={workspaceMeta}
      title="Your submissions"
      description="Submit item details for specialist review. When approved, a draft lot is created for cataloguing and scheduling."
      actions={
        <Button variant="primary" asChild>
          <Link href={DASHBOARD_ROUTES.submissionsNew}>
            <Plus className="size-4" aria-hidden />
            {DASHBOARD_CTA.newSubmission}
          </Link>
        </Button>
      }
      errorAlert={
        <>
          {orgActingSelected ? <SellerOrgContextBanner /> : null}
          {queryFailure ? <DashboardSliceErrorAlert failure={queryFailure} /> : null}
          {loadFailure ? <DashboardSliceErrorAlert failure={loadFailure} /> : null}
        </>
      }
    >
      {!hasBlockingError ? (
        <>
          <SetMobileShellTitle title="Submissions" />
          <SubmissionsListAutoRefresh
            enabled={
              statusCounts.submitted > 0 ||
              statusCounts.under_review > 0 ||
              statusCounts.approved > 0
            }
          />
          <Suspense fallback={<DashboardSkeleton variant="list" />}>
            <SubmissionsBoard
              rows={mapped}
              initialStatus={initialStatus}
              initialQ={initialQ}
              fetchedCount={total}
              statusCounts={statusCounts}
            />
            <CatalogPagination
              offset={offset}
              limit={PAGE_SIZE}
              countOnPage={mapped.length}
              total={total}
              prevHref={prevLink}
              nextHref={nextLink}
            />
          </Suspense>
        </>
      ) : null}
    </DashboardListPage>
  );
}
