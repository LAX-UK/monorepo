import { PageSkeleton } from "@auction/ui/components/page-skeleton";

/** Loading placeholder aligned with `CatalogFormShell` geometry. */
export function AdminCatalogFormSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-3xl space-y-6 pb-28 md:max-w-4xl md:space-y-8 md:pb-8"
      aria-busy="true"
      aria-label="Loading form"
    >
      <PageSkeleton variant="dashboard" />
    </div>
  );
}
