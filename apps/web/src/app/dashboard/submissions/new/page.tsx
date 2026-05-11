import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { NewSubmissionForm } from "@/components/dashboard/new-submission-form";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";

export default async function NewSubmissionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const error = sp.error ? decodeURIComponent(sp.error) : null;
  const catReader = await getServerCategoryReader();
  const categories = await catReader.tree();

  return (
    <DashboardPage className="mx-auto max-w-2xl space-y-6">
      {error ? (
        <Alert variant="destructive" className="rounded-xl border-error/40 shadow-sm">
          <AlertTitle>Could not save</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <NewSubmissionForm categories={categories} />
    </DashboardPage>
  );
}
