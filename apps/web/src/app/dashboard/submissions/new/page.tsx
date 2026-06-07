import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import { SellerOrgContextBanner } from "@/components/dashboard/seller-org-context-banner";
import { SubmissionResubmitBanner } from "@/components/dashboard/submission-resubmit-banner";
import { SubmissionWizard } from "@/components/dashboard/submission-wizard/submission-wizard";
import { SetMobileShellTitle } from "@/components/layout/set-mobile-shell-title";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { DASHBOARD_ROUTES } from "@/lib/dashboard/dashboard-copy";
import { describeSettingsActionError } from "@/lib/dashboard/dashboard-fetch-errors";
import { SETTINGS_CONTENT_MAX_WIDTH } from "@/lib/dashboard/settings-layout-classes";
import { getServerDataContainer } from "@/lib/data/container.server";
import {
  EMPTY_SUBMISSION_FORM_VALUES,
  itemSubmissionToFormValues,
} from "@/lib/forms/submission/item-submission-form-defaults";
import { findCategoryIdBySlug } from "@/lib/forms/submission/resolve-category-slug";
import { resolveSellerWorkspaceContext } from "@/lib/legal-entity/seller-acting-context.server";
import { readClientWorkspacePageMeta } from "@/lib/workspace/client-workspace-mode";
import Link from "next/link";

export default async function NewSubmissionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; fromRejected?: string; categorySlug?: string }>;
}) {
  const sp = await searchParams;
  const error = sp.error ? decodeURIComponent(sp.error) : null;
  const user = await requireAuthenticatedUser({
    shell: "client",
    loginNext: "/dashboard/submissions/new",
  });
  const { orgActingSelected } = await resolveSellerWorkspaceContext(
    user.role,
    user.staffRole ?? null,
  );
  const c = await getServerDataContainer();
  const categories = await c.categories.tree();
  const workspaceMeta = await readClientWorkspacePageMeta();

  const fromRejectedId =
    typeof sp.fromRejected === "string" && sp.fromRejected.length > 0 ? sp.fromRejected : null;
  const priorRejected = fromRejectedId
    ? await c.submissions.getMineById(fromRejectedId).catch(() => null)
    : null;
  const resubmitFrom =
    priorRejected?.status === "rejected"
      ? {
          initialValues: itemSubmissionToFormValues(priorRejected),
          rejectionReason: priorRejected.rejectionReason,
          reviewNotes: priorRejected.reviewNotes,
        }
      : null;

  const categorySlug =
    typeof sp.categorySlug === "string" && sp.categorySlug.length > 0 ? sp.categorySlug : null;
  const preselectedCategoryId = categorySlug
    ? findCategoryIdBySlug(categories, categorySlug)
    : null;
  const categoryPreselect =
    !resubmitFrom && preselectedCategoryId
      ? {
          ...EMPTY_SUBMISSION_FORM_VALUES,
          categoryIds: [preselectedCategoryId],
        }
      : null;

  return (
    <DashboardPage className={`mx-auto w-full space-y-6 ${SETTINGS_CONTENT_MAX_WIDTH}`}>
      <DashboardPageHeader
        meta={workspaceMeta}
        title="New submission"
        hideTitleOnMobile
        hideDescriptionOnMobile
        description="Tell our specialists about an artwork or collectible. Your progress is saved when you continue later."
        actions={
          <Link
            href={DASHBOARD_ROUTES.submissions}
            className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary underline-offset-4 hover:underline"
          >
            ← Submissions
          </Link>
        }
      />
      {orgActingSelected ? <SellerOrgContextBanner /> : null}
      {error ? <DashboardSliceErrorAlert failure={describeSettingsActionError(error)} /> : null}
      {resubmitFrom ? (
        <SubmissionResubmitBanner
          rejectionReason={resubmitFrom.rejectionReason}
          reviewNotes={resubmitFrom.reviewNotes}
        />
      ) : null}
      <SetMobileShellTitle title="New submission" />
      <SubmissionWizard
        mode={{ kind: "create" }}
        categories={categories}
        {...(resubmitFrom
          ? { initialValues: resubmitFrom.initialValues }
          : categoryPreselect
            ? { initialValues: categoryPreselect }
            : {})}
      />
    </DashboardPage>
  );
}
