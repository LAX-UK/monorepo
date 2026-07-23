import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import type { SaleAttentionResult } from "@auction/domain";

export type AdminSaleAttention = SaleAttentionResult;

export async function getAdminSaleAttention(saleId: string): Promise<AdminSaleAttention | null> {
  try {
    const res = await authedServerFetch(`/admin/sales/${encodeURIComponent(saleId)}/attention`);
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`Failed to load sale attention: ${res.status}`);
    }
    const body = (await res.json()) as { data?: SaleAttentionResult };
    const data = body.data;
    if (!data) throw new Error("Missing sale attention payload");
    return data;
  } catch (err) {
    console.error("[getAdminSaleAttention] Failed to load sale attention:", err);
    return null;
  }
}
