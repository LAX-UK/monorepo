import { getAdminSaleById, getAdminSalesList } from "@/lib/data/http/admin.server";
import type { Sale } from "@auction/types";

export type AssignableSale = Pick<
  Sale,
  "id" | "title" | "status" | "deliveryMode" | "startTime" | "endTime"
>;

export type LotFormAssignableSalesResult = {
  sales: AssignableSale[];
  /** The resolved current sale when `currentSaleId` was provided (null if not found). */
  currentSale: AssignableSale | null;
};

/** Draft sales for assignment, plus the lot's current sale when it is no longer draft.
 *
 * Returns both the full list (for the picker) and the resolved `currentSale` so callers can
 * inspect its status without making a second API call. */
export async function getLotFormAssignableSales(
  currentSaleId?: string | null,
): Promise<LotFormAssignableSalesResult> {
  const draftRows = await getAdminSalesList({ status: "draft", limit: 100 }).catch(() => []);
  const sales: AssignableSale[] = draftRows.map((row) => row.sale);

  const currentId = currentSaleId?.trim();
  if (!currentId) {
    return { sales, currentSale: null };
  }

  const existing = sales.find((s) => s.id === currentId) ?? null;
  if (existing) {
    return { sales, currentSale: existing };
  }

  const row = await getAdminSaleById(currentId).catch(() => null);
  if (row) {
    sales.unshift(row.sale);
    return { sales, currentSale: row.sale };
  }

  return { sales, currentSale: null };
}
