import "server-only";

import {
  type HeldSaleDto,
  type LotSellerProceedsDto,
  type OldRulePageDto,
  type PayoutSalesDto,
  heldSalesSchema,
  lotSellerProceedsSchema,
  oldRulePageSchema,
  payoutSalesSchema,
} from "@/lib/data/http/admin-seller-proceeds.shared";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { cache } from "react";
import type { z } from "zod";

const BASE = "/admin/seller-proceeds";

async function readData<T>(
  path: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
): Promise<T | null> {
  const res = await authedServerFetch(`${BASE}${path}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Seller proceeds read ${path} failed: ${res.status}`);
  const body = (await res.json()) as { data?: unknown };
  return schema.parse(body.data);
}

/** A lot's seller side; one load per request so the header notice and Overview share it. */
export const getLotSellerProceeds = cache(
  async (lotId: string): Promise<LotSellerProceedsDto | null> =>
    readData(`/lots/${encodeURIComponent(lotId)}`, lotSellerProceedsSchema),
);

/** Each sale on a payout with the snapshot it pays, and the seller's sales still held. */
export async function getPayoutSales(payoutId: string): Promise<PayoutSalesDto | null> {
  return readData(`/payouts/${encodeURIComponent(payoutId)}`, payoutSalesSchema);
}

/** Every paid sale held for a missing fact, across sellers. */
export async function getHeldSales(): Promise<HeldSaleDto[]> {
  return (await readData("/held-sales", heldSalesSchema)) ?? [];
}

/** Sales paid under the old rule, each beside what its agreement gives. */
export async function getOldRulePage(page: {
  limit: number;
  offset: number;
}): Promise<OldRulePageDto> {
  const qs = new URLSearchParams({ limit: String(page.limit), offset: String(page.offset) });
  const res = await authedServerFetch(`${BASE}/old-rule?${qs.toString()}`);
  if (!res.ok) throw new Error(`Old-rule review read failed: ${res.status}`);
  return oldRulePageSchema.parse(await res.json());
}
