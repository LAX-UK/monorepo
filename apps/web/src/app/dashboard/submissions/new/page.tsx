import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { NewSubmissionForm } from "@/components/dashboard/new-submission-form";
import { DashboardErrorAlert } from "@/components/dashboard/primitives";
import { getServerDataContainer } from "@/lib/data/container.server";

export default async function NewSubmissionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const error = sp.error ? decodeURIComponent(sp.error) : null;
  const c = await getServerDataContainer();
  const categories = await c.categories.tree();

  return (
    <DashboardPage className="mx-auto max-w-2xl space-y-6">
      {error ? <DashboardErrorAlert title="Could not save" message={error} /> : null}
      <NewSubmissionForm categories={categories} />
    </DashboardPage>
  );
}
