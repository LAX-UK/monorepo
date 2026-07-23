import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import type { LotAttentionResult } from "@auction/domain";

export type AdminLotAttention = LotAttentionResult;

export const EMPTY_ADMIN_LOT_ATTENTION: AdminLotAttention = {
  items: [],
  totalCount: 0,
  truncated: false,
};

export async function getAdminLotAttention(lotId: string): Promise<AdminLotAttention> {
  try {
    const res = await authedServerFetch(`/admin/lots/${encodeURIComponent(lotId)}/attention`);
    if (!res.ok) throw new Error(`Failed to load lot attention: ${res.status}`);
    const body = (await res.json()) as { data?: AdminLotAttention };
    const data = body.data;
    if (!data) throw new Error("Missing lot attention payload");
    return data;
  } catch (err) {
    console.error("[getAdminLotAttention] Failed to load lot attention:", err);
    return EMPTY_ADMIN_LOT_ATTENTION;
  }
}
