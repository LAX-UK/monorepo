import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const pressFilterSchema = z.object({
  q: z.string().trim().max(200),
  year: z.string(),
  mentionType: z.string(),
});

export type PressFilterValues = z.infer<typeof pressFilterSchema>;

/** The press filters' check, loaded with its first use (see `lazyResolver`). */
export const pressFilterResolver = zodResolver(pressFilterSchema);
