import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import { SubmissionWizard } from "@/components/dashboard/submission-wizard/submission-wizard";
import { SetMobileShellTitle } from "@/components/layout/set-mobile-shell-title";
import { describeSettingsActionError } from "@/lib/dashboard/dashboard-fetch-errors";
import { getServerDataContainer } from "@/lib/data/container.server";
import { readClientWorkspacePageMeta } from "@/lib/workspace/client-workspace-mode";
import Link from "next/link";

export default async function NewSubmissionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const error = sp.error ? decodeURIComponent(sp.error) : null;
  const c = await getServerDataContainer();
  const categories = await c.categories.tree();
  const workspaceMeta = await readClientWorkspacePageMeta();

  return (
    <DashboardPage className="mx-auto max-w-3xl space-y-6">
      <DashboardPageHeader
        meta={workspaceMeta}
        title="New submission"
        hideTitleOnMobile
        hideDescriptionOnMobile
        description="Tell our specialists about an artwork or collectible. Your progress is saved when you continue later."
        actions={
          <Link
            href="/dashboard/submissions"
            className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary underline-offset-4 hover:underline"
          >
            ← Submissions
          </Link>
        }
      />
      {error ? <DashboardSliceErrorAlert failure={describeSettingsActionError(error)} /> : null}
      <SetMobileShellTitle title="New submission" />
      <SubmissionWizard mode={{ kind: "create" }} categories={categories} />
    </DashboardPage>
  );
}
