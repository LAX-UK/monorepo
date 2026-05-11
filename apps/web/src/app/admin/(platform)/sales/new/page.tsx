import { AdminSaleForm } from "@/components/admin/admin-sale-form";
import { AppScreen } from "@/components/dashboard/dashboard-page";
import { DisplayHeading } from "@/components/ui/typography";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { emptyAdminSaleFormValues } from "@/lib/forms/schemas/admin-sale-defaults";
import Link from "next/link";

export default async function AdminNewSalePage() {
  const categories = await (await getServerCategoryReader()).tree();

  return (
    <AppScreen className="mx-auto max-w-2xl space-y-8">
      <Link
        href="/admin/sales"
        className="font-label text-xs uppercase tracking-widest text-primary hover:underline"
      >
        ← Sales
      </Link>
      <DisplayHeading as="h1" className="text-4xl">
        New sale
      </DisplayHeading>

      <AdminSaleForm
        mode="create"
        defaultValues={emptyAdminSaleFormValues()}
        categories={categories}
      />
    </AppScreen>
  );
}
