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
    <>
      {error ? (
        <div className="mx-auto mb-6 max-w-2xl">
          <Alert variant="destructive">
            <AlertTitle>Could not save</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      ) : null}
      <NewSubmissionForm categories={categories} />
    </>
  );
}
