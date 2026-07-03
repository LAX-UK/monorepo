import { saleListRowSchema } from "@/lib/data/http/sales.schema";
import type { Sale } from "@auction/types";
import { z } from "zod";

export type RelatedSale = {
  sale: Sale;
  lotCount: number;
};

export type GetRelatedSalesParams = {
  id: string;
  categoryId?: string | null;
  limit?: number;
};

export const saleFollowStateSchema = z
  .object({ isFollowing: z.unknown() })
  .transform((data) => ({ isFollowing: Boolean(data.isFollowing) })) as z.ZodType<{
  isFollowing: boolean;
}>;

export const relatedSaleRowSchema = saleListRowSchema.transform((parsed) => ({
  sale: parsed.sale,
  lotCount: parsed.lotCount,
})) as z.ZodType<RelatedSale>;
