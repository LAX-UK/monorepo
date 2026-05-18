import { userRoles, userStaffRoles } from "@auction/types";
import { z } from "zod";
import { mediaReferenceSchema } from "./media.js";

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  image: mediaReferenceSchema.nullable().optional(),
});

/** RHF: display name only. */
export const updateProfileNameFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
});

export const setRoleSchema = z.object({
  userId: z.string().min(1).max(191),
  role: z.enum(userRoles),
});

export const adminSetRoleBodySchema = z
  .object({
    role: z.enum(userRoles),
    staffRole: z.enum(userStaffRoles).optional().nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.role === "staff") {
      if (v.staffRole == null) {
        ctx.addIssue({
          code: "custom",
          message: "staffRole is required when role is staff",
          path: ["staffRole"],
        });
      }
    } else if (v.staffRole != null) {
      ctx.addIssue({
        code: "custom",
        message: "staffRole must be omitted when role is client",
        path: ["staffRole"],
      });
    }
  });

/** @deprecated Prefer {@link adminSetRoleBodySchema} with `role` + `staffRole`. */
export const adminSetStaffRoleBodySchema = z.object({
  staffRole: z.enum(userStaffRoles).nullable(),
});

/** Better Auth user ids are opaque strings (not always UUID). */
export const userIdParamSchema = z.object({
  userId: z.string().min(1).max(191),
});

export const watchlistLotIdParamSchema = z.object({
  lotId: z.string().uuid(),
});

export const notificationIdUuidParamSchema = z.object({
  notificationId: z.string().uuid(),
});

export const adminUserListQuerySchema = z.object({
  q: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
  offset: z.coerce.number().int().min(0).max(10_000).optional().default(0),
  role: z.enum(userRoles).optional(),
  staffRole: z.enum(userStaffRoles).optional(),
  suspended: z.enum(["1"]).optional(),
});

export const adminSuspendBodySchema = z.object({
  reason: z.string().max(500).optional(),
});

export const adminBulkUsersBodySchema = z.object({
  ids: z.array(z.string().min(1).max(191)).min(1).max(50),
  op: z.enum(["suspend", "unsuspend"]),
  reason: z.string().max(500).optional(),
});

export const adminAnalyticsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).optional().default(30),
});
