import { itemSubmissionStatuses } from "@auction/types";
import { z } from "zod";

export function splitUrlLines(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const decimalRegex = /^\d+(\.\d{1,2})?$/;

export const newSubmissionFormSchema = z
  .object({
    title: z.string().min(1, "Title is required").max(500),
    description: z.string().max(10_000),
    medium: z.string().max(500),
    dimensions: z.string().max(200),
    categoryId: z.string().uuid({ message: "Choose a category" }),
    imagesText: z.string(),
    askingPrice: z.string(),
    reservePrice: z.string(),
    submitterNotes: z.string().max(5000),
  })
  .superRefine((data, ctx) => {
    const ap = data.askingPrice.trim();
    if (ap && !decimalRegex.test(ap)) {
      ctx.addIssue({
        code: "custom",
        message: "Must be a valid decimal (e.g. 1200 or 1200.50)",
        path: ["askingPrice"],
      });
    }
    const rp = data.reservePrice.trim();
    if (rp && !decimalRegex.test(rp)) {
      ctx.addIssue({
        code: "custom",
        message: "Must be a valid decimal (e.g. 1200 or 1200.50)",
        path: ["reservePrice"],
      });
    }
    const lines = splitUrlLines(data.imagesText);
    if (lines.length > 20) {
      ctx.addIssue({ code: "custom", message: "At most 20 images", path: ["imagesText"] });
      return;
    }
    for (const line of lines) {
      if (!z.string().url().safeParse(line).success) {
        ctx.addIssue({
          code: "custom",
          message: "Each non-empty line must be a valid image URL",
          path: ["imagesText"],
        });
        return;
      }
    }
  });

export type NewSubmissionFormValues = z.infer<typeof newSubmissionFormSchema>;

export const submissionListFilterSchema = z.object({
  status: z.union([z.literal("all"), z.enum(itemSubmissionStatuses)]),
});

export type SubmissionListFilterValues = z.infer<typeof submissionListFilterSchema>;
