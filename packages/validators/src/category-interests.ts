import { z } from "zod";

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
