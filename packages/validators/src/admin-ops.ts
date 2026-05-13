import { z } from "zod";

/** GET /admin/conveyor-pipeline — recent submissions with optional converted lot join. */
export const adminConveyorPipelineQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional().default(200),
});
