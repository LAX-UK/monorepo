import { laxStaffAccessProductSchema, userRoles, userStaffRoles } from "@auction/types";
import { z } from "zod";

export const invitationTargetRoleSchema = z.enum(userRoles);

export const invitationGrantSchema = z.object({
  product: laxStaffAccessProductSchema,
  role: z.string().trim().min(1).max(64),
});

/**
 * Either `grants` (one staff role per LAX platform) or the legacy Bid-only
 * `targetRole` / `targetStaffRole` pair. Roles per platform are validated by the API.
 */
export const adminCreateInvitationBodySchema = z
  .object({
    email: z.string().email(),
    targetRole: invitationTargetRoleSchema.optional(),
    targetStaffRole: z.enum(userStaffRoles).optional(),
    grants: z
      .array(invitationGrantSchema)
      .max(laxStaffAccessProductSchema.options.length)
      .optional(),
  })
  .superRefine((v, ctx) => {
    if (v.grants && v.grants.length > 0) {
      if (v.targetStaffRole != null) {
        ctx.addIssue({
          code: "custom",
          message: "Use grants or targetStaffRole, not both",
          path: ["targetStaffRole"],
        });
      }
      return;
    }
    if (v.targetRole == null) {
      ctx.addIssue({
        code: "custom",
        message: "targetRole is required without grants",
        path: ["targetRole"],
      });
      return;
    }
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

export const invitationAcceptBodySchema = invitationPreviewQuerySchema;

export const adminBulkInvitationsBodySchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(50),
  op: z.enum(["revoke", "resend"]),
});

const invitationListStatusSchema = z.enum(["pending", "accepted", "revoked", "expired"]);

export const adminInvitationsListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(200),
  offset: z.coerce.number().int().min(0).optional().default(0),
  status: invitationListStatusSchema.optional(),
  q: z.string().trim().max(200).optional(),
});
