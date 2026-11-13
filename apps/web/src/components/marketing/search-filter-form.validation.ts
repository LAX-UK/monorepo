import { errorCopy } from "@/lib/forms/error-copy";
import { publicFormResolver } from "@/lib/forms/public-form-resolver";
import { z } from "zod";

const searchFilterSchema = z.object({
  q: z.string().trim().max(200, errorCopy.maxLength(200, "your search")),
});

export type SearchFilterValues = z.infer<typeof searchFilterSchema>;

/** The search box's check, loaded with its first use (see `lazyResolver`). */
export const searchFilterResolver = publicFormResolver(searchFilterSchema);
