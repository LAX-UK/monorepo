import { z } from "zod";

export const reauthBodySchema = z.object({
  password: z.string().min(1, "Password is required"),
});

export type ReauthBody = z.infer<typeof reauthBodySchema>;
