import { z } from "zod";
import { newPasswordWeakListCheck } from "./password-policy.js";

/** First-time password setup body for OAuth-only users (identity service contract). */
export const setupPasswordBodySchema = z
  .object({
    password: z.string().min(12).max(128),
  })
  .superRefine((d, ctx) => newPasswordWeakListCheck(d.password, ctx, ["password"]));
