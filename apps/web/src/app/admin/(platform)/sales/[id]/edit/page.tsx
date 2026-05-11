import { AdminSaleForm } from "@/components/admin/admin-sale-form";
import { AppScreen } from "@/components/dashboard/dashboard-page";
import { DisplayHeading } from "@/components/ui/typography";
import { getAdminSaleById } from "@/lib/data/http/admin.server";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { saleToAdminSaleFormValues } from "@/lib/forms/schemas/admin-sale-defaults";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function AdminEditSalePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [bundle, categories] = await Promise.all([
    getAdminSaleById(id),
    (async () => (await getServerCategoryReader()).tree())(),
  ]);
  if (!bundle) notFound();
  const { sale } = bundle;
  if (sale.status !== "draft") {
    return (
      <AppScreen className="max-w-xl space-y-4">
        <p className="text-on-surface-variant">Only draft sales can be edited.</p>
        <Link href={`/admin/sales/${id}`} className="text-primary underline">
          Back to sale
        </Link>
      </AppScreen>
    );
  }

  return (
    <AppScreen className="mx-auto max-w-2xl space-y-8">
      <Link
        href={`/admin/sales/${id}`}
        className="font-label text-xs uppercase tracking-widest text-primary hover:underline"
      >
        ← Sale
      </Link>
      <DisplayHeading as="h1" className="text-4xl">
        Edit sale
      </DisplayHeading>

      <AdminSaleForm
        mode="edit"
        saleId={id}
        defaultValues={saleToAdminSaleFormValues(sale)}
        categories={categories}
      />
    </AppScreen>
  );
}
