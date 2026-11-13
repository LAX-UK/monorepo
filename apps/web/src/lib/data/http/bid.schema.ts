import { parseBidRow } from "@/lib/data/http/bid-row";
import type { Bid } from "@auction/types";
import { z } from "zod";

/** The bid row as a Zod schema, for envelopes that compose schemas; the reading is `parseBidRow`. */
const bidRowSchema = z.unknown().transform((row): Bid => parseBidRow(row));

export const bidSchema = bidRowSchema as z.ZodType<Bid>;

export function parseBidSchema(raw: unknown): Bid {
  return bidSchema.parse(raw);
}

type _BidInfer = z.infer<typeof bidSchema>;
const _bidTypeGuard = null as unknown as _BidInfer satisfies Bid;
void _bidTypeGuard;
