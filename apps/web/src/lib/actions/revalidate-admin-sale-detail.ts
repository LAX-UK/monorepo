import { revalidateCatalogueCache } from "@/lib/actions/revalidate-catalogue";
import { revalidatePath } from "next/cache";

export function revalidateAdminSaleDetail(saleId: string) {
  revalidateCatalogueCache();
  revalidatePath("/admin/sales");
  revalidatePath(`/admin/sales/${saleId}`);
  revalidatePath(`/admin/sales/${saleId}/setup`);
  revalidatePath(`/admin/sales/${saleId}/schedule`);
  revalidatePath(`/admin/sales/${saleId}/lots`);
  revalidatePath(`/admin/sales/${saleId}/documents`);
  revalidatePath(`/admin/sales/${saleId}/media`);
  revalidatePath(`/admin/sales/${saleId}/registrations`);
}
