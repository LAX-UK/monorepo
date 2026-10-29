import { z } from "zod";

/** Platforms whose staff roles are granted through LAX-wide invitations. */
export const laxStaffAccessProductSchema = z.enum(["bid", "shop"]);
export type LaxStaffAccessProduct = z.infer<typeof laxStaffAccessProductSchema>;

/**
 * Emitted by Bid when a staff role on another platform is given, from the staff record or an
 * accepted invitation. The platform adds the role to the ones the person holds. Roles are
 * platform-local strings; each consumer validates against its own role set.
 */
export const laxStaffAccessGrantedPayloadSchemaV1 = z.object({
  schemaVersion: z.literal(1),
  subjectId: z.string().min(1),
  product: laxStaffAccessProductSchema,
  role: z.string().min(1),
  grantedBySubjectId: z.string().min(1),
  invitationId: z.string().uuid().nullable(),
  /** When the role ends; absent or null keeps it until someone removes it. */
  endsAt: z.string().datetime({ offset: true }).nullable().optional(),
  /** Why the role was given; a staff-typed note kept in the platform's audit log. */
  reason: z.string().max(500).nullable().optional(),
});
export type LaxStaffAccessGrantedPayloadV1 = z.infer<typeof laxStaffAccessGrantedPayloadSchemaV1>;

/**
 * Emitted by Bid when staff access on another platform is taken away: one role when `role` is
 * set, every role otherwise. `assignmentId` names the one assignment whose end date passed, when
 * the daily expiry job records it.
 */
export const laxStaffAccessRevokedPayloadSchemaV1 = z.object({
  schemaVersion: z.literal(1),
  subjectId: z.string().min(1),
  product: laxStaffAccessProductSchema,
  revokedBySubjectId: z.string().min(1),
  role: z.string().min(1).optional(),
  assignmentId: z.string().uuid().optional(),
  reason: z.string().max(500).nullable().optional(),
});
export type LaxStaffAccessRevokedPayloadV1 = z.infer<typeof laxStaffAccessRevokedPayloadSchemaV1>;

/** A Bid staff role given to a person (the aggregate). The actor is the event's. */
export const staffRoleAssignedPayloadSchemaV1 = z
  .object({
    assignmentId: z.string().uuid(),
    role: z.string().min(1),
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }).nullable(),
    reason: z.string().max(500).nullable(),
  })
  .strict();
export type StaffRoleAssignedPayloadV1 = z.infer<typeof staffRoleAssignedPayloadSchemaV1>;

/** A Bid staff role taken away from a person (the aggregate); the assignment ends then. */
export const staffRoleRemovedPayloadSchemaV1 = z
  .object({
    assignmentId: z.string().uuid(),
    role: z.string().min(1),
    reason: z.string().max(500).nullable(),
  })
  .strict();
export type StaffRoleRemovedPayloadV1 = z.infer<typeof staffRoleRemovedPayloadSchemaV1>;

/** A Bid staff role whose end date passed; recorded once by the daily expiry job. */
export const staffRoleExpiredPayloadSchemaV1 = z
  .object({
    assignmentId: z.string().uuid(),
    role: z.string().min(1),
    endedAt: z.string().datetime({ offset: true }),
  })
  .strict();
export type StaffRoleExpiredPayloadV1 = z.infer<typeof staffRoleExpiredPayloadSchemaV1>;
