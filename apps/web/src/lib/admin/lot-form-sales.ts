import { getAdminSaleById, getAdminSalesList } from "@/lib/data/http/admin.server";
import type { Sale } from "@auction/types";

type AssignableSale = Pick<
  Sale,
  "id" | "title" | "status" | "deliveryMode" | "startTime" | "endTime"
>;

/** Draft sales for assignment, plus the lot's current sale when it is no longer draft. */
export async function getLotFormAssignableSales(
  currentSaleId?: string | null,
): Promise<AssignableSale[]> {
  const draftRows = await getAdminSalesList({ status: "draft", limit: 100 }).catch(() => []);
  const sales: AssignableSale[] = draftRows.map((row) => row.sale);

  const currentId = currentSaleId?.trim();
  if (currentId && !sales.some((s) => s.id === currentId)) {
    const row = await getAdminSaleById(currentId).catch(() => null);
    if (row) {
      sales.unshift(row.sale);
    }
  }

  return sales;
}
