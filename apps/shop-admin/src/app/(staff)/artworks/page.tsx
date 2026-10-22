import {
  GrantSaleAuthorityForm,
  ImportArtworkForm,
} from "@/components/admin-staff-action-forms.client";
import { PageHeader } from "@auction/ui";

export const metadata = { title: "Artworks" };

export default function ShopAdminArtworksPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Artworks"
        description="Import catalogue rows and grant sale authority to owners."
      />
      <ImportArtworkForm />
      <GrantSaleAuthorityForm />
    </div>
  );
}
