import { revalidateCatalogueCache } from "@/lib/actions/revalidate-catalogue";
import { revalidatePath } from "next/cache";

export function revalidateAdminUserListPaths(): void {
  revalidatePath("/admin/clients");
  revalidatePath("/admin/staff");
}

export function revalidateAdminUserDetailPaths(userId: string): void {
  revalidateAdminUserListPaths();
  revalidatePath(`/admin/clients/${userId}`);
  revalidatePath(`/admin/staff/${userId}`);
}

export function revalidateAdminLotDetail(lotId: string): void {
  revalidateCatalogueCache();
  revalidatePath("/admin/lots");
  revalidatePath(`/admin/lots/${lotId}`);
  revalidatePath(`/admin/lots/${lotId}/images`);
  revalidatePath(`/admin/lots/${lotId}/documents`);
  revalidatePath(`/admin/lots/${lotId}/bids`);
  revalidatePath(`/admin/lots/${lotId}/edit`);
  revalidatePath(`/admin/lots/${lotId}/edit/catalog`);
  revalidatePath(`/admin/lots/${lotId}/edit/documents`);
}

export function revalidateAdminCategoryDetail(categoryId: string): void {
  revalidatePath("/admin/categories");
  revalidatePath(`/admin/categories/${categoryId}`);
  revalidatePath(`/admin/categories/${categoryId}/edit`);
  revalidatePath(`/admin/categories/${categoryId}/children`);
  revalidatePath(`/admin/categories/${categoryId}/lots`);
}
