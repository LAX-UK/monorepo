import { userRoles } from "@auction/types";
import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  image: z.string().url().nullable().optional(),
});

export const setRoleSchema = z.object({
  userId: z.string(),
  role: z.enum(userRoles),
});
