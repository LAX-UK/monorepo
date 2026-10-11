import { z } from "zod";

/** Platforms whose staff roles are granted through LAX-wide invitations. */
export const laxStaffAccessProductSchema = z.enum(["bid", "shop"]);
export type LaxStaffAccessProduct = z.infer<typeof laxStaffAccessProductSchema>;

/**
 * Emitted by Bid when an accepted invitation grants a staff role on another platform.
 * Roles are platform-local strings; each consumer validates against its own role set.
 */
export const laxStaffAccessGrantedPayloadSchemaV1 = z.object({
  schemaVersion: z.literal(1),
  subjectId: z.string().min(1),
  product: laxStaffAccessProductSchema,
  role: z.string().min(1),
  grantedBySubjectId: z.string().min(1),
  invitationId: z.string().uuid().nullable(),
});
export type LaxStaffAccessGrantedPayloadV1 = z.infer<typeof laxStaffAccessGrantedPayloadSchemaV1>;

export const laxStaffAccessRevokedPayloadSchemaV1 = z.object({
  schemaVersion: z.literal(1),
  subjectId: z.string().min(1),
  product: laxStaffAccessProductSchema,
  revokedBySubjectId: z.string().min(1),
});
export type LaxStaffAccessRevokedPayloadV1 = z.infer<typeof laxStaffAccessRevokedPayloadSchemaV1>;
