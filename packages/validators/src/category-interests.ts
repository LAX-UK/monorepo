import { z } from "zod";

export const BUYER_INTEREST_CATEGORY_SEEDS = {
  art: {
    id: "c1000001-0000-4000-8000-000000000001",
    name: "Paintings",
    slug: "paintings",
    sortOrder: 1,
  },
  sculpture: {
    id: "c1000002-0000-4000-8000-000000000002",
    name: "Sculpture",
    slug: "sculpture",
    sortOrder: 2,
  },
  "something-else": {
    id: "c1000005-0000-4000-8000-000000000005",
    name: "Mixed Media",
    slug: "mixed-media",
    sortOrder: 5,
  },
  watches: {
    id: "c1000012-0000-4000-8000-000000000012",
    name: "Watches & Clocks",
    slug: "watches-clocks",
    sortOrder: 12,
  },
  coins: {
    id: "c1000014-0000-4000-8000-000000000014",
    name: "Coins & Medals",
    slug: "coins-medals",
    sortOrder: 14,
  },
  jewellery: {
    id: "c1000017-0000-4000-8000-000000000017",
    name: "Jewellery",
    slug: "jewellery",
    sortOrder: 17,
  },
  antiques: {
    id: "c1000018-0000-4000-8000-000000000018",
    name: "Antiques",
    slug: "antiques",
    sortOrder: 18,
  },
  memorabilia: {
    id: "c1000019-0000-4000-8000-000000000019",
    name: "Memorabilia",
    slug: "memorabilia",
    sortOrder: 19,
  },
} as const;

export type BuyerInterestCategoryKey = keyof typeof BUYER_INTEREST_CATEGORY_SEEDS;

export const BUYER_INTEREST_CATEGORY_SLUGS = Object.values(BUYER_INTEREST_CATEGORY_SEEDS).map(
  ({ slug }) => slug,
);

const categoryIdSchema = z.string().uuid("Invalid category ID");

export const categoryInterestsPutSchema = z
  .object({
    categoryIds: z.array(categoryIdSchema).max(20, "Select at most 20 categories"),
  })
  .superRefine(({ categoryIds }, ctx) => {
    if (new Set(categoryIds).size !== categoryIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["categoryIds"],
        message: "Category IDs must be unique",
      });
    }
  });

export type CategoryInterestsPut = z.infer<typeof categoryInterestsPutSchema>;
