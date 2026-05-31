import { user, type userKycStatusEnum, type userStaffRoleEnum } from "@auction/db/schema";
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
import type { AdminUserListFilter, AdminUserListSort } from "../services/interfaces/admin-user.js";

export function buildAdminUserListWhere(filter: AdminUserListFilter): SQL | undefined {
  const clauses: SQL[] = [];

  const q = filter.q?.trim();
  if (q) {
    const searchClause = or(
      ilike(user.email, `%${q}%`),
      ilike(user.name, `%${q}%`),
      ilike(user.mobile, `%${q}%`),
    );
    if (searchClause) clauses.push(searchClause);
  }

  if (filter.role) {
    clauses.push(eq(user.role, filter.role));
  }

  if (filter.staffRole) {
    clauses.push(
      eq(user.staffRole, filter.staffRole as (typeof userStaffRoleEnum.enumValues)[number]),
    );
  }

  if (filter.accountStatus === "active") {
    clauses.push(isNull(user.suspendedAt));
  } else if (filter.accountStatus === "suspended" || filter.suspendedOnly) {
    clauses.push(isNotNull(user.suspendedAt));
  }

  if (filter.emailVerified !== undefined) {
    clauses.push(eq(user.emailVerified, filter.emailVerified));
  }

  if (filter.emailStatus) {
    clauses.push(eq(user.emailStatus, filter.emailStatus));
  }

  if (filter.kycStatuses?.length) {
    clauses.push(
      inArray(
        user.kycStatus,
        filter.kycStatuses as (typeof userKycStatusEnum.enumValues)[number][],
      ),
    );
  } else if (filter.kycStatus) {
    clauses.push(eq(user.kycStatus, filter.kycStatus));
  }

  if (filter.persona === "none") {
    clauses.push(isNull(user.signupPersona));
  } else if (filter.persona) {
    clauses.push(eq(user.signupPersona, filter.persona));
  }

  if (filter.twoFactorEnabled !== undefined) {
    clauses.push(eq(user.twoFactorEnabled, filter.twoFactorEnabled));
  }

  if (filter.deletionRequestedOnly) {
    clauses.push(isNotNull(user.deletionRequestedAt));
  }

  if (filter.hasMobile === true) {
    const hasMobileClause = and(isNotNull(user.mobile), sql`trim(${user.mobile}) <> ''`);
    if (hasMobileClause) clauses.push(hasMobileClause);
  } else if (filter.hasMobile === false) {
    const noMobileClause = or(isNull(user.mobile), sql`trim(coalesce(${user.mobile}, '')) = ''`);
    if (noMobileClause) clauses.push(noMobileClause);
  }

  if (filter.createdFrom) {
    clauses.push(gte(user.createdAt, filter.createdFrom));
  }
  if (filter.createdToExclusive) {
    clauses.push(lt(user.createdAt, filter.createdToExclusive));
  }

  if (filter.kycVerifiedFrom) {
    clauses.push(gte(user.kycVerifiedAt, filter.kycVerifiedFrom));
  }
  if (filter.kycVerifiedToExclusive) {
    clauses.push(lt(user.kycVerifiedAt, filter.kycVerifiedToExclusive));
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
      return asc(user.kycStatus);
    default:
      return desc(user.createdAt);
  }
}

/** Shared projection for list and detail list-shaped fields. */
export const adminUserListSelect = {
  id: user.id,
  email: user.email,
  name: user.name,
  firstName: user.firstName,
  lastName: user.lastName,
  role: user.role,
  staffRole: user.staffRole,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  suspendedAt: user.suspendedAt,
  image: user.image,
  mobile: user.mobile,
  mobileCountry: user.mobileCountry,
  emailVerified: user.emailVerified,
  emailStatus: user.emailStatus,
  signupPersona: user.signupPersona,
  twoFactorEnabled: user.twoFactorEnabled,
  kycStatus: user.kycStatus,
  kycVerifiedAt: user.kycVerifiedAt,
  kycRetryCount: user.kycRetryCount,
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
