import { userRoles, userStaffRoles } from "@auction/types";
import { z } from "zod";

export const invitationTargetRoleSchema = z.enum(userRoles);

export const adminCreateInvitationBodySchema = z
  .object({
    email: z.string().email(),
    targetRole: invitationTargetRoleSchema,
    targetStaffRole: z.enum(userStaffRoles).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.targetRole === "staff" && v.targetStaffRole == null) {
      ctx.addIssue({
        code: "custom",
        message: "targetStaffRole is required for staff invitations",
        path: ["targetStaffRole"],
      });
    }
    if (v.targetRole === "client" && v.targetStaffRole != null) {
      ctx.addIssue({
        code: "custom",
        message: "targetStaffRole must be omitted for client invitations",
        path: ["targetStaffRole"],
      });
    }
  });

export const invitationIdUuidParamSchema = z.object({
  invitationId: z.string().uuid(),
});

export const invitationPreviewQuerySchema = z.object({
  token: z.string().min(16).max(512),
});

export const adminBulkInvitationsBodySchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(50),
  op: z.enum(["revoke", "resend"]),
});

export const adminInvitationsListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(200),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
