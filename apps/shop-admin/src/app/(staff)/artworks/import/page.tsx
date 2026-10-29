import { AdminBreadcrumbs } from "@/components/admin-breadcrumbs";
import { AdminFailedPage } from "@/components/admin-fetch-state";
import { ImportArtworkForm } from "@/components/artworks/import-artwork-form.client";
import { canOpenForm } from "@/server/application/can-open-form";
import { FormPage } from "@auction/staff-ui";

export const metadata = { title: "Import artwork" };

/**
 * Creates or refreshes an artwork from an external catalogue row by its import key. The editor
 * covers everyday work; this stays for re-syncing a row, which the editor does not do.
 */
export default async function ImportArtworkPage() {
  if (!(await canOpenForm("catalogue.write"))) {
    return <AdminFailedPage title="Import artwork" status="forbidden" />;
  }
  return (
    <FormPage
      breadcrumbs={
        <AdminBreadcrumbs list={{ label: "Artworks", href: "/artworks" }} current="Import" />
      }
      title="Import by catalogue key"
      description="Creates the artwork, or updates the one already imported under the same key. A new import starts as a draft; publish it from the artwork list or editor. To add a new artwork by hand, use New artwork instead."
    >
      <ImportArtworkForm />
    </FormPage>
  );
}
