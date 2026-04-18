import { z } from "zod";

export const watchlistBodySchema = z.object({
  lotId: z.string().uuid(),
});
