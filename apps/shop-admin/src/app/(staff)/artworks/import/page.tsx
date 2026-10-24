import { AdminBreadcrumbs } from "@/components/admin-breadcrumbs";
import { ImportArtworkForm } from "@/components/forms/catalogue/import-artwork-form.client";
import { PageHeader } from "@auction/staff-ui";

export const metadata = { title: "Import artwork" };

/**
 * Creates or refreshes an artwork from an external catalogue row by its import key. The editor
 * covers everyday work; this stays for re-syncing a row, which the editor does not do.
 */
export default function ImportArtworkPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumbs={
          <AdminBreadcrumbs list={{ label: "Artworks", href: "/artworks" }} current="Import" />
        }
        title="Import by catalogue key"
        description="Creates the artwork, or updates the one already imported under the same key. Imported artworks are published straight away. To add a new artwork by hand, use New artwork instead."
      />
      <ImportArtworkForm />
    </div>
  );
}
