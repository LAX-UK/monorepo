import { revalidateCatalogueCache } from "@/lib/actions/revalidate-catalogue";
import { publicPageTagsForLot } from "@auction/domain";
import { revalidatePath, revalidateTag } from "next/cache";

export function revalidateAdminUserListPaths(): void {
  revalidatePath("/admin/clients");
  revalidatePath("/admin/staff");
}

export function revalidateAdminUserDetailPaths(userId: string): void {
  revalidateAdminUserListPaths();
  revalidatePath(`/admin/clients/${userId}`);
  revalidatePath(`/admin/staff/${userId}`);
}

/**
 * The public cache tags a staff edit of a lot drops: the lot's page, and the catalogue of every
 * sale it was or now is in (its card, and the lot navigation built from the sale's lots, show the
 * title, image, estimate and schedule). Without a sale only the lot's own tag.
 */
export function publicTagsForAdminLotEdit(
  lotId: string,
  saleIds: readonly (string | null | undefined)[] = [],
): string[] {
  const tags = new Set<string>(publicPageTagsForLot({ id: lotId }));
  for (const saleId of saleIds) {
    for (const tag of publicPageTagsForLot({ id: lotId, saleId: saleId ?? null })) tags.add(tag);
  }
  return [...tags];
}

/**
 * `saleIds` are the sales the lot was in before the edit and is in after it. A bulk change
 * (publish, cancel, delete) passes none: each emits a lot domain event, and the worker's purge
 * looks up the lot's sale for it.
 */
export function revalidateAdminLotDetail(
  lotId: string,
  saleIds: readonly (string | null | undefined)[] = [],
): void {
  revalidateCatalogueCache();
  // A staff edit (title, images, estimate, close time) has no domain event: drop the public page
  // and the sale catalogue that shows the lot's card.
  for (const tag of publicTagsForAdminLotEdit(lotId, saleIds)) revalidateTag(tag);
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
