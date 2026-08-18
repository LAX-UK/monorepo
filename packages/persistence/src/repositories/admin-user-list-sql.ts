import {
  bidUserProfile,
  user,
  type userKycStatusEnum,
  type userStaffRoleEnum,
} from "@auction/db/schema";
import {
  type SQL,
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";
import type {
  AdminUserListFilter,
  AdminUserListSort,
} from "../interfaces/admin-user.repository.js";

export function buildAdminUserListWhere(filter: AdminUserListFilter): SQL | undefined {
  const clauses: SQL[] = [];

  const q = filter.q?.trim();
  if (q) {
    const searchClause = or(
      ilike(user.email, `%${q}%`),
      ilike(user.name, `%${q}%`),
      ilike(bidUserProfile.mobile, `%${q}%`),
    );
    if (searchClause) clauses.push(searchClause);
  }

  if (filter.role) {
    const roleClause =
      filter.role === "client"
        ? or(eq(bidUserProfile.role, "client"), isNull(bidUserProfile.userId))
        : eq(bidUserProfile.role, filter.role);
    if (roleClause) clauses.push(roleClause);
  }

  if (filter.staffRole) {
    clauses.push(
      eq(
        bidUserProfile.staffRole,
        filter.staffRole as (typeof userStaffRoleEnum.enumValues)[number],
      ),
    );
  }

  if (filter.accountStatus === "active") {
    clauses.push(isNull(bidUserProfile.suspendedAt));
  } else if (filter.accountStatus === "suspended" || filter.suspendedOnly) {
    clauses.push(isNotNull(bidUserProfile.suspendedAt));
  }

  if (filter.emailVerified !== undefined) {
    clauses.push(eq(user.emailVerified, filter.emailVerified));
  }

  if (filter.emailStatus) {
    const emailStatusClause =
      filter.emailStatus === "ok"
        ? or(eq(bidUserProfile.emailStatus, "ok"), isNull(bidUserProfile.userId))
        : eq(bidUserProfile.emailStatus, filter.emailStatus);
    if (emailStatusClause) clauses.push(emailStatusClause);
  }

  if (filter.kycStatuses?.length) {
    clauses.push(
      inArray(
        bidUserProfile.kycStatus,
        filter.kycStatuses as (typeof userKycStatusEnum.enumValues)[number][],
      ),
    );
  } else if (filter.kycStatus) {
    const kycClause =
      filter.kycStatus === "unverified"
        ? or(eq(bidUserProfile.kycStatus, "unverified"), isNull(bidUserProfile.userId))
        : eq(bidUserProfile.kycStatus, filter.kycStatus);
    if (kycClause) clauses.push(kycClause);
  }

  if (filter.persona === "none") {
    clauses.push(isNull(bidUserProfile.signupPersona));
  } else if (filter.persona) {
    clauses.push(eq(bidUserProfile.signupPersona, filter.persona));
  }

  if (filter.twoFactorEnabled !== undefined) {
    clauses.push(eq(user.twoFactorEnabled, filter.twoFactorEnabled));
  }

  if (filter.deletionRequestedOnly) {
    clauses.push(isNotNull(user.deletionRequestedAt));
  }

  if (filter.hasMobile === true) {
    const hasMobileClause = and(
      isNotNull(bidUserProfile.mobile),
      sql`trim(${bidUserProfile.mobile}) <> ''`,
    );
    if (hasMobileClause) clauses.push(hasMobileClause);
  } else if (filter.hasMobile === false) {
    const noMobileClause = or(
      isNull(bidUserProfile.mobile),
      sql`trim(coalesce(${bidUserProfile.mobile}, '')) = ''`,
    );
    if (noMobileClause) clauses.push(noMobileClause);
  }

  if (filter.createdFrom) {
    clauses.push(gte(user.createdAt, filter.createdFrom));
  }
  if (filter.createdToExclusive) {
    clauses.push(lt(user.createdAt, filter.createdToExclusive));
  }

  if (filter.kycVerifiedFrom) {
    clauses.push(gte(bidUserProfile.kycVerifiedAt, filter.kycVerifiedFrom));
  }
  if (filter.kycVerifiedToExclusive) {
    clauses.push(lt(bidUserProfile.kycVerifiedAt, filter.kycVerifiedToExclusive));
  }

  if (filter.lastActiveFrom) {
    clauses.push(gte(user.updatedAt, filter.lastActiveFrom));
  }
  if (filter.lastActiveToExclusive) {
    clauses.push(lt(user.updatedAt, filter.lastActiveToExclusive));
  }

  return clauses.length > 0 ? and(...clauses) : undefined;
}

export function buildAdminUserListOrderBy(sort: AdminUserListSort | undefined) {
  switch (sort ?? "created_desc") {
    case "created_asc":
      return asc(user.createdAt);
    case "name_asc":
      return asc(user.name);
    case "name_desc":
      return desc(user.name);
    case "last_active_desc":
      return desc(user.updatedAt);
    case "kyc_status":
      return asc(bidUserProfile.kycStatus);
    default:
      return desc(user.createdAt);
  }
}

/** Shared projection for list and detail list-shaped fields. */
export const adminUserListSelect = {
  id: user.id,
  email: user.email,
  name: user.name,
  firstName: bidUserProfile.firstName,
  lastName: bidUserProfile.lastName,
  role: sql<string>`coalesce(${bidUserProfile.role}, 'client')`,
  staffRole: bidUserProfile.staffRole,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  suspendedAt: bidUserProfile.suspendedAt,
  image: user.image,
  mobile: bidUserProfile.mobile,
  mobileCountry: bidUserProfile.mobileCountry,
  emailVerified: user.emailVerified,
  emailStatus: sql<string>`coalesce(${bidUserProfile.emailStatus}, 'ok')`,
  signupPersona: bidUserProfile.signupPersona,
  twoFactorEnabled: user.twoFactorEnabled,
  kycStatus: sql<string>`coalesce(${bidUserProfile.kycStatus}, 'unverified')`,
  kycVerifiedAt: bidUserProfile.kycVerifiedAt,
  kycRetryCount: sql<number>`coalesce(${bidUserProfile.kycRetryCount}, 0)::int`,
  deletionRequestedAt: user.deletionRequestedAt,
} as const;

export function mapAdminUserListRow(r: {
  id: string;
  email: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  staffRole: (typeof userStaffRoleEnum.enumValues)[number] | null;
  createdAt: Date;
  updatedAt: Date;
  suspendedAt: Date | null;
  image: string | null;
  mobile: string | null;
  mobileCountry: string | null;
  emailVerified: boolean;
  emailStatus: string;
  signupPersona: string | null;
  twoFactorEnabled: boolean;
  kycStatus: string;
  kycVerifiedAt: Date | null;
  kycRetryCount: number;
  deletionRequestedAt: Date | null;
}) {
  return {
    id: r.id,
    email: r.email,
    name: r.name,
    firstName: r.firstName ?? null,
    lastName: r.lastName ?? null,
    role: r.role,
    staffRole: r.staffRole ?? null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    suspendedAt: r.suspendedAt ?? null,
    image: r.image ?? null,
    mobile: r.mobile ?? null,
    mobileCountry: r.mobileCountry ?? null,
    emailVerified: r.emailVerified,
    emailStatus: r.emailStatus,
    signupPersona: r.signupPersona ?? null,
    twoFactorEnabled: r.twoFactorEnabled,
    kycStatus: r.kycStatus,
    kycVerifiedAt: r.kycVerifiedAt ?? null,
    kycRetryCount: r.kycRetryCount,
    deletionRequestedAt: r.deletionRequestedAt ?? null,
  };
}
