import { userEmailStatuses, userKycStatuses, userRoles, userStaffRoles } from "@auction/types";
import { z } from "zod";
import { mediaReferenceSchema } from "./media.js";
import { phoneCountrySchema, phoneInputSchema } from "./mobile.js";
import { resolvePhoneFromBody } from "./phone/resolve.js";

export const updateProfileSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    image: mediaReferenceSchema.nullable().optional(),
    phone: phoneInputSchema.nullable().optional(),
    /** @deprecated Prefer `phone`. */
    mobile: z.string().trim().max(32).nullable().optional(),
    mobileCountry: phoneCountrySchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.phone === null && data.mobile === null) return;
    const r = resolvePhoneFromBody(data);
    if (!r.ok) {
      ctx.addIssue({ code: "custom", message: r.message, path: r.path });
    }
  })
  .transform((data) => {
    const { phone: _phone, mobile: _legacy, mobileCountry: _legacyCc, ...rest } = data;
    if (data.phone === null && data.mobile === null) {
      return { ...rest, mobile: null as string | null, mobileCountry: null as string | null };
    }
    const r = resolvePhoneFromBody(data);
    if (!r.ok || !r.value) return rest;
    return { ...rest, mobile: r.value.e164, mobileCountry: r.value.country };
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

export const adminPatchStaffRoleBodySchema = z.object({
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

const adminUserListTriStateSchema = z.enum(["1", "0"]);

const adminUserListIsoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const adminUserListSortEnum = z.enum([
  "created_desc",
  "created_asc",
  "name_asc",
  "name_desc",
  "last_active_desc",
  "kyc_status",
]);

export const adminUserListStatusEnum = z.enum(["active", "suspended"]);

export const adminUserListPersonaFilterEnum = z.enum([
  "individual",
  "organisation",
  "none",
] as const);

const kycStatusEnum = z.enum(userKycStatuses);

export const adminUserListQuerySchema = z
  .object({
    q: z.string().trim().max(200).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional().default(25),
    offset: z.coerce.number().int().min(0).max(10_000).optional().default(0),
    role: z.enum(userRoles).optional(),
    staffRole: z.enum(userStaffRoles).optional(),
    /** @deprecated Prefer `status=suspended`. Kept for bookmarked URLs. */
    suspended: z.enum(["1"]).optional(),
    status: adminUserListStatusEnum.optional(),
    emailVerified: adminUserListTriStateSchema.optional(),
    emailStatus: z.enum(userEmailStatuses).optional(),
    kycStatus: kycStatusEnum.optional(),
    /** Comma-separated KYC statuses; takes precedence over `kycStatus` when both sent. */
    kycStatuses: z
      .string()
      .trim()
      .max(80)
      .optional()
      .transform((raw) => {
        if (!raw) return undefined;
        const tokens = raw
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
        const out: z.infer<typeof kycStatusEnum>[] = [];
        for (const t of tokens) {
          const p = kycStatusEnum.safeParse(t);
          if (p.success) out.push(p.data);
        }
        return out.length ? out : undefined;
      }),
    persona: adminUserListPersonaFilterEnum.optional(),
    twoFactor: adminUserListTriStateSchema.optional(),
    deletionRequested: z.enum(["1"]).optional(),
    hasMobile: adminUserListTriStateSchema.optional(),
    createdFrom: adminUserListIsoDateSchema.optional(),
    createdTo: adminUserListIsoDateSchema.optional(),
    kycVerifiedFrom: adminUserListIsoDateSchema.optional(),
    kycVerifiedTo: adminUserListIsoDateSchema.optional(),
    lastActiveFrom: adminUserListIsoDateSchema.optional(),
    lastActiveTo: adminUserListIsoDateSchema.optional(),
    sort: adminUserListSortEnum.optional().default("created_desc"),
  })
  .superRefine((data, ctx) => {
    const ranges: [string | undefined, string | undefined, string][] = [
      [data.createdFrom, data.createdTo, "created"],
      [data.kycVerifiedFrom, data.kycVerifiedTo, "kycVerified"],
      [data.lastActiveFrom, data.lastActiveTo, "lastActive"],
    ];
    for (const [from, to, label] of ranges) {
      if (from && to && from > to) {
        ctx.addIssue({
          code: "custom",
          message: `${label}From must be on or before ${label}To`,
          path: [`${label}From`],
        });
      }
    }
    if (data.suspended === "1" && data.status === "active") {
      ctx.addIssue({
        code: "custom",
        message: "status=active conflicts with suspended=1",
        path: ["status"],
      });
    }
  });

export type AdminUserListQuery = z.infer<typeof adminUserListQuerySchema>;

/** Batch lookup for admin tables (payments buyer labels, lot bids, etc.). */
export const adminUserIdsLookupQuerySchema = z.object({
  ids: z
    .string()
    .trim()
    .min(1)
    .max(2000)
    .transform((raw) =>
      raw
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().uuid()).min(1).max(50)),
});

export type AdminUserIdsLookupQuery = z.infer<typeof adminUserIdsLookupQuerySchema>;

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
