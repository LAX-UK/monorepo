import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import { SellWithLaxFlow } from "@/components/dashboard/seller/sell-with-lax-flow";
import { SubmissionResubmitBanner } from "@/components/dashboard/submission-resubmit-banner";
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
import { SELL_A_WORK_LABEL } from "@/lib/marketing/sell-flow-copy";
import { REGISTER_ORGANISATION_HREF } from "@/lib/navigation/account-switcher-model";
import { sellerAccountChoice } from "@/lib/seller/seller-account-options";
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
  const sellerCtx = await resolveSellerWorkspaceContext(user.role, user.staffRoles);
  // Who may sell as which account comes from each account's capabilities; a finance member of a
  // gallery can still sell under their own name.
  const choice = sellerAccountChoice({
    memberships: sellerCtx.memberships,
    personalName: user.name,
    actingId: sellerCtx.sellerEntityId,
  });
  if (choice.options.length === 0) redirect(DASHBOARD_ROUTES.consignments);
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
  const initialValues =
    resubmitFrom?.initialValues ??
    (preselectedCategoryId
      ? { ...EMPTY_SUBMISSION_FORM_VALUES, categoryIds: [preselectedCategoryId] }
      : undefined);

  return (
    <DashboardPage className={`mx-auto w-full space-y-6 ${SETTINGS_CONTENT_MAX_WIDTH}`}>
      <DashboardPageHeader
        title={SELL_A_WORK_LABEL}
        description="Tell us about the work. A specialist reviews every work, and there's no obligation to sell."
      />
      {error ? <DashboardSliceErrorAlert failure={describeSettingsActionError(error)} /> : null}
      {resubmitFrom ? (
        <SubmissionResubmitBanner
          rejectionReason={resubmitFrom.rejectionReason}
          reviewNotes={resubmitFrom.reviewNotes}
        />
      ) : null}
      <SetMobileShellTitle title={SELL_A_WORK_LABEL} />
      <SellWithLaxFlow
        categories={categories}
        choice={choice}
        registerHref={REGISTER_ORGANISATION_HREF}
        {...(initialValues ? { initialValues } : {})}
      />
    </DashboardPage>
  );
}
