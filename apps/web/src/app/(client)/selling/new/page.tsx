import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
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
import {
  resolveSellerWorkspaceContext,
  sellerCan,
} from "@/lib/legal-entity/seller-acting-context.server";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function NewSubmissionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; fromRejected?: string; categorySlug?: string }>;
}) {
  const sp = await searchParams;
  const error = sp.error ? decodeURIComponent(sp.error) : null;
  const categorySlug =
    typeof sp.categorySlug === "string" && sp.categorySlug.length > 0 ? sp.categorySlug : null;
  const loginNext = categorySlug
    ? `/selling/new?categorySlug=${encodeURIComponent(categorySlug)}`
    : "/selling/new";
  const user = await requireAuthenticatedUser({
    shell: "client",
    loginNext,
  });
  // Finance members and viewers can follow an organisation's consignments but not start one.
  const sellerCtx = await resolveSellerWorkspaceContext(user.role, user.staffRole ?? null);
  if (!sellerCan(sellerCtx, "entity.submissions.create")) redirect(DASHBOARD_ROUTES.consignments);
  const c = await getServerDataContainer();
  const categories = await c.categories.tree();
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
        title="New submission"
        hideTitleOnMobile
        hideDescriptionOnMobile
        description="Tell our specialists about an artwork or collectible. After your first save, progress syncs automatically on the submission page."
        actions={
          <Link
            href={DASHBOARD_ROUTES.consignments}
            className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-link underline-offset-4 hover:underline"
          >
            ← Consignments
          </Link>
        }
      />
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
