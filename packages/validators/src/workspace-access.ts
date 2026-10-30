import { legalEntityMemberRoles } from "@auction/types";
import { z } from "zod";

/** Ask for a role, or for one capability, with a reason the deciders read. */
export const accessAskBodySchema = z.union([
  z
    .object({
      role: z.enum(legalEntityMemberRoles),
      reason: z.string().trim().min(3).max(500),
    })
    .strict(),
  z
    .object({
      capability: z.string().trim().min(3).max(80),
      reason: z.string().trim().min(3).max(500),
    })
    .strict(),
]);
export type AccessAskBody = z.infer<typeof accessAskBodySchema>;

export const accessRequestIdParamSchema = z.object({ requestId: z.string().uuid() });

export const accessRequestListQuerySchema = z.object({
  status: z.enum(["pending", "approved", "declined", "withdrawn"]).optional(),
});

/** Approve: a capability request needs the role to give; a note is optional. */
export const accessApproveBodySchema = z
  .object({
    role: z.enum(legalEntityMemberRoles).optional(),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export const accessDeclineBodySchema = z
  .object({ note: z.string().trim().max(500).optional() })
  .strict();
