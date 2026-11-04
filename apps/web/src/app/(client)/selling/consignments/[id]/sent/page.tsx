import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { SubmissionSentPanel } from "@/components/dashboard/seller/submission-sent-panel";
import { SubmissionSentTracker } from "@/components/dashboard/seller/submission-sent-tracker";
import { SetMobileShellTitle } from "@/components/layout/set-mobile-shell-title";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { getServerDataContainer } from "@/lib/data/container.server";
import { SPECIALIST_RESPONSE_PROMISE } from "@/lib/marketing/sell-flow-copy";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { consignmentHref } from "@/lib/seller/consignment-records";
import { notFound, redirect } from "next/navigation";

export const metadata = { title: "Sent to our specialists" };

/**
 * Where the form lands once a work is sent: the reference, when to expect an answer and what the
 * stages are from here. A consignment still in draft was not sent, so it opens as itself.
 */
export default async function SubmissionSentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAuthenticatedUser({
    shell: "client",
    loginNext: `${consignmentHref(id)}/sent`,
  });
  const c = await getServerDataContainer();
  const submission = await c.submissions.getMineById(id).catch(() => null);
  if (!submission) notFound();
  if (submission.status === "draft") redirect(consignmentHref(id));

  return (
    <DashboardPage className="space-y-6">
      <SetMobileShellTitle title="Sent to our specialists" />
      <SubmissionSentTracker submissionId={submission.id} />
      <SubmissionSentPanel
        reference={submission.reference ?? null}
        consignmentHref={consignmentHref(submission.id)}
        sellAnotherHref={CLIENT_ROUTES.sellingNew}
        responsePromise={SPECIALIST_RESPONSE_PROMISE}
      />
    </DashboardPage>
  );
}
