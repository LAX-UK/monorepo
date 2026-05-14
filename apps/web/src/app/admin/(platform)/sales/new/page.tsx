import { AdminEntityFormShell } from "@/components/admin/admin-entity-form-shell";
import { AdminSaleForm } from "@/components/admin/admin-sale-form";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { isEnglishOnlyAuctionsLocked } from "@/lib/feature-flags/english-only-auctions";
import { emptyAdminSaleFormValues } from "@/lib/forms/schemas/admin-sale-defaults";
import Link from "next/link";

export default async function AdminNewSalePage() {
  const categories = await (await getServerCategoryReader()).tree();
  const englishOnlyAuctionsLocked = isEnglishOnlyAuctionsLocked();

  return (
    <AdminEntityFormShell
      breadcrumbs={
        <Link
          href="/admin/sales"
          className="font-label text-xs uppercase tracking-widest text-primary hover:underline"
        >
          ← Sales
        </Link>
      }
      title="New sale"
    >
      <AdminSaleForm
        mode="create"
        defaultValues={emptyAdminSaleFormValues()}
        categories={categories}
        englishOnlyAuctionsLocked={englishOnlyAuctionsLocked}
      />
    </AdminEntityFormShell>
  );
}
