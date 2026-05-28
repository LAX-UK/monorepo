import { getServerSalesList } from "@/lib/data/http/sales.server";

/** Whether at least one active sale exists (for live-first landing). */
export async function fetchHasLiveSales(): Promise<boolean> {
  try {
    const rows = await getServerSalesList({
      status: "active",
      limit: 1,
      offset: 0,
      sort: "startAsc",
    });
    return rows.length > 0;
  } catch {
    return false;
  }
}
