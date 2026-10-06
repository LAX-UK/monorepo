import {
  GrantSaleAuthorityForm,
  ImportArtworkForm,
} from "@/components/admin-staff-action-forms.client";

export default function ShopAdminArtworksPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-2 text-2xl font-semibold">Artworks</h1>
        <p className="text-sm text-on-surface-variant">
          Import catalogue rows and grant sale authority to owners.
        </p>
      </div>
      <ImportArtworkForm />
      <GrantSaleAuthorityForm />
    </div>
  );
}
