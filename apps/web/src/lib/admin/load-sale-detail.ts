import { type AdminSaleListRow, getAdminSaleById } from "@/lib/data/http/admin.server";
import { notFound } from "next/navigation";
import { cache } from "react";

/** Deduped sale bundle fetch for layout + tab routes. */
export const loadAdminSaleDetail = cache(async (saleId: string): Promise<AdminSaleListRow> => {
  const bundle = await getAdminSaleById(saleId);
  if (!bundle) notFound();
  return bundle;
});
