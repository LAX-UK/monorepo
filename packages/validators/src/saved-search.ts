import { z } from "zod";

export const savedSearchBodySchema = z.object({
  label: z.string().trim().min(1).max(120),
  query: z.record(z.string(), z.string()).refine((q) => Object.keys(q).length > 0, {
    message: "Query must include at least one parameter",
  }),
  notifyEmail: z.boolean().optional().default(true),
});

export const savedSearchIdParamSchema = z.object({
  id: z.string().uuid(),
});
