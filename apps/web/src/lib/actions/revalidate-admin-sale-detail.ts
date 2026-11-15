import { revalidateCatalogueCache } from "@/lib/actions/revalidate-catalogue";
import { publicSaleTag } from "@/lib/data/cache-tags";
import { revalidatePath, revalidateTag } from "next/cache";

export function revalidateAdminSaleDetail(saleId: string) {
  revalidateCatalogueCache();
  // A staff edit of the sale or its lots has no domain event: drop the public sale page.
  revalidateTag(publicSaleTag(saleId));
  revalidatePath("/admin/sales");
  revalidatePath(`/admin/sales/${saleId}`);
  revalidatePath(`/admin/sales/${saleId}/setup`);
  revalidatePath(`/admin/sales/${saleId}/schedule`);
  revalidatePath(`/admin/sales/${saleId}/lots`);
  revalidatePath(`/admin/sales/${saleId}/documents`);
  revalidatePath(`/admin/sales/${saleId}/media`);
  revalidatePath(`/admin/sales/${saleId}/registrations`);
}
