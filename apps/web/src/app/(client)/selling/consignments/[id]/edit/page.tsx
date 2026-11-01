import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { AccountLoadError } from "@/components/dashboard/primitives/account-load-error";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import { SubmissionWizard } from "@/components/dashboard/submission-wizard/submission-wizard";
import { SetMobileShellTitle } from "@/components/layout/set-mobile-shell-title";
import { WorkspacePageNoAccess } from "@/components/organisations/workspace-page-no-access";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { ACCOUNT_LOAD_ERROR } from "@/lib/dashboard/dashboard-copy";
import { SETTINGS_CONTENT_MAX_WIDTH } from "@/lib/dashboard/settings-layout-classes";
import { getServerDataContainer } from "@/lib/data/container.server";
import { itemSubmissionToFormValues } from "@/lib/forms/submission/item-submission-form-defaults";
import {
  firstIncompleteWizardStepIndex,
  wizardStepIndex,
} from "@/lib/forms/submission/step-validation";
import { openRecordInItsAccount } from "@/lib/legal-entity/open-record-in-account.server";
import { resolveSellerWorkspaceContext } from "@/lib/legal-entity/seller-acting-context.server";
import {
  SUBMISSION_CHANGES_SUBMIT_LABEL,
  SUBMISSION_SUBMIT_LABEL,
} from "@/lib/marketing/sell-flow-copy";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { workspacePageRefusal } from "@/lib/presenters/workspace-access/workspace-access";
import { consignmentActionsVm } from "@/lib/seller/consignment-actions.vm";
import { consignmentHref } from "@/lib/seller/consignment-records";
import { evaluateSubmissionQuality } from "@auction/domain";
import { Notice } from "@auction/ui/lax";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

export const metadata: Metadata = { title: "Make changes" };

type PageProps = { params: Promise<{ id: string }> };

/**
 * Where a seller changes a consignment: the Sell a work form on this work, opened at "Check
 * answers" once it is complete, else at the first step still missing. The consignment's own page
 * stays a record. Only people who may edit it get here; everyone else is taken back to the record.
 */
export default async function EditConsignmentPage({ params }: PageProps) {
  const { id } = await params;
  const path = `${consignmentHref(id)}/edit`;
  const user = await requireAuthenticatedUser({ shell: "client", loginNext: path });
  const sellerCtx = await resolveSellerWorkspaceContext(user.role, user.staffRoles);
  const refusal = workspacePageRefusal(CLIENT_ROUTES.consignments, sellerCtx.actor);
  if (refusal) {
    return (
      <>
        <SetMobileShellTitle title="Make changes" />
        <WorkspacePageNoAccess
          label={refusal.label}
          openedBy={refusal.openedBy}
          next={consignmentHref(id)}
        />
      </>
    );
  }
  const c = await getServerDataContainer();
  const [submissionRes, categoriesRes] = await Promise.allSettled([
    c.submissions.getMineById(id),
    c.categories.tree(),
  ]);
  if (submissionRes.status === "rejected" || categoriesRes.status === "rejected") {
    return (
      <DashboardPage>
        <SetMobileShellTitle title="Make changes" />
        <AccountLoadError {...ACCOUNT_LOAD_ERROR.consignment} />
      </DashboardPage>
    );
  }
  const submission = submissionRes.value;
  if (!submission) {
    await openRecordInItsAccount({
      kind: "consignment",
      id,
      actingId: sellerCtx.sellerEntityId,
      next: path,
    });
    notFound();
  }
  const actions = consignmentActionsVm({
    actor: sellerCtx.actor ? { userId: user.id, member: sellerCtx.actor } : null,
    submission,
  });
  if (!actions.canEdit) redirect(consignmentHref(id));

  const values = itemSubmissionToFormValues(submission);
  const complete = evaluateSubmissionQuality(submission).canSubmit;
  const sentBack = submission.status === "changes_requested";
  return (
    <DashboardPage className={`mx-auto w-full space-y-6 ${SETTINGS_CONTENT_MAX_WIDTH}`}>
      <SetMobileShellTitle title="Make changes" />
      <DashboardPageHeader
        title="Make changes"
        description={
          sentBack
            ? `Update ${submission.title} the way your specialist asked, then send it back.`
            : `Finish ${submission.title}, then send it to our specialists.`
        }
      />
      {sentBack && submission.changesRequestedNote ? (
        <Notice tone="warning" title="What your specialist asked for" className="mt-3">
          <span className="whitespace-pre-line">{submission.changesRequestedNote}</span>
        </Notice>
      ) : null}
      <SubmissionWizard
        mode={{ kind: "edit", submissionId: submission.id }}
        categories={categoriesRes.value}
        initialValues={values}
        initialStepIndex={
          complete ? wizardStepIndex("review") : firstIncompleteWizardStepIndex(values)
        }
        readyToSubmit={complete}
        submitLabel={sentBack ? SUBMISSION_CHANGES_SUBMIT_LABEL : SUBMISSION_SUBMIT_LABEL}
      />
    </DashboardPage>
  );
}
