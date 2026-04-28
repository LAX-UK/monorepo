import { userRoles } from "@auction/types";
import { z } from "zod";

export const invitationTargetRoleSchema = z.enum(userRoles);

export const adminCreateInvitationBodySchema = z.object({
  email: z.string().email(),
  targetRole: invitationTargetRoleSchema,
});

export const invitationIdUuidParamSchema = z.object({
  invitationId: z.string().uuid(),
});

export const invitationPreviewQuerySchema = z.object({
  token: z.string().min(16).max(512),
});
