import type { SessionUser } from "@/lib/data/contracts";
import { toObjectRecord } from "@/lib/data/http/object-guards";
import { type UserStaffRole, normalizeUserRoleOrClient, userStaffRoles } from "@auction/types";
import { coerceToDate } from "./coerce";

function optionalNullableDate(value: unknown): Date | null {
  if (value == null || value === "") return null;
  return coerceToDate(value);
}

function hasOwn(row: Record<string, unknown>, key: string): boolean {
  return Object.hasOwn(row, key);
}

function parseUiPreferences(raw: unknown): SessionUser["uiPreferences"] | undefined {
  const row = toObjectRecord(raw);
  const theme = row.theme;
  if (theme !== "light" && theme !== "dark" && theme !== "system") return undefined;
  const out: NonNullable<SessionUser["uiPreferences"]> = { theme };
  const viewLotsDefault = row.viewLotsDefault;
  if (
    viewLotsDefault === "grid" ||
    viewLotsDefault === "card" ||
    viewLotsDefault === "list" ||
    viewLotsDefault === "auto"
  ) {
    out.viewLotsDefault = viewLotsDefault;
  }
  const viewArtistsDefault = row.viewArtistsDefault;
  if (
    viewArtistsDefault === "grid" ||
    viewArtistsDefault === "card" ||
    viewArtistsDefault === "list" ||
    viewArtistsDefault === "auto"
  ) {
    out.viewArtistsDefault = viewArtistsDefault;
  }
  const viewSalesDefault = row.viewSalesDefault;
  if (
    viewSalesDefault === "grid" ||
    viewSalesDefault === "card" ||
    viewSalesDefault === "list" ||
    viewSalesDefault === "auto"
  ) {
    out.viewSalesDefault = viewSalesDefault;
  }
  const density = row.density;
  if (density === "comfortable" || density === "compact") out.density = density;
  if (typeof row.viewSync === "boolean") out.viewSync = row.viewSync;
  return out;
}

/** Row parser for `GET /users/me`. */
export function parseSessionUser(raw: unknown): SessionUser {
  const row = toObjectRecord(raw);
  const out: SessionUser = {
    id: String(row.id ?? ""),
    email: String(row.email ?? ""),
    name: String(row.name ?? row.email ?? ""),
    role: normalizeUserRoleOrClient(typeof row.role === "string" ? row.role : undefined),
  };

  if (hasOwn(row, "image")) out.image = row.image == null ? null : String(row.image);

  const staffRole = row.staffRole;
  if (typeof staffRole === "string" && (userStaffRoles as readonly string[]).includes(staffRole)) {
    out.staffRole = staffRole as UserStaffRole;
  }
  if (row.mobile != null && row.mobile !== "") out.mobile = String(row.mobile);
  if (row.phoneNumber != null && row.phoneNumber !== "") out.phoneNumber = String(row.phoneNumber);
  if (typeof row.phoneNumberVerified === "boolean")
    out.phoneNumberVerified = row.phoneNumberVerified;
  if (row.mobileCountry != null && row.mobileCountry !== "") {
    out.mobileCountry = String(row.mobileCountry);
  }
  if (row.mobileDisplay != null && row.mobileDisplay !== "") {
    out.mobileDisplay = String(row.mobileDisplay);
  }
  if (typeof row.suspended === "boolean") out.suspended = row.suspended;
  if (typeof row.emailVerified === "boolean") out.emailVerified = row.emailVerified;
  const emailStatus = row.emailStatus;
  if (emailStatus === "ok" || emailStatus === "bounced" || emailStatus === "complained") {
    out.emailStatus = emailStatus;
  }
  const emailStatusChangedAt = hasOwn(row, "emailStatusChangedAt")
    ? optionalNullableDate(row.emailStatusChangedAt)
    : undefined;
  if (emailStatusChangedAt !== undefined) out.emailStatusChangedAt = emailStatusChangedAt;
  if (typeof row.hasSeenActingContextTooltip === "boolean") {
    out.hasSeenActingContextTooltip = row.hasSeenActingContextTooltip;
  }
  const kycStatus = row.kycStatus;
  if (
    kycStatus === "unverified" ||
    kycStatus === "pending" ||
    kycStatus === "approved" ||
    kycStatus === "rejected"
  ) {
    out.kycStatus = kycStatus;
  }
  const signupPersona = row.signupPersona;
  if (signupPersona === "individual" || signupPersona === "organisation") {
    out.signupPersona = signupPersona;
  } else if (signupPersona === null) {
    out.signupPersona = null;
  }
  const categoryInterestsOnboardingCompletedAt = hasOwn(
    row,
    "categoryInterestsOnboardingCompletedAt",
  )
    ? optionalNullableDate(row.categoryInterestsOnboardingCompletedAt)
    : undefined;
  if (categoryInterestsOnboardingCompletedAt !== undefined) {
    out.categoryInterestsOnboardingCompletedAt = categoryInterestsOnboardingCompletedAt;
  }
  const deletionRequestedAt = hasOwn(row, "deletionRequestedAt")
    ? optionalNullableDate(row.deletionRequestedAt)
    : undefined;
  if (deletionRequestedAt !== undefined) out.deletionRequestedAt = deletionRequestedAt;
  if (row.pendingNewEmail != null) out.pendingNewEmail = String(row.pendingNewEmail);
  if (typeof row.twoFactorEnabled === "boolean") out.twoFactorEnabled = row.twoFactorEnabled;
  if (typeof row.securityStatusAvailable === "boolean") {
    out.securityStatusAvailable = row.securityStatusAvailable;
  }
  const uiPreferences = parseUiPreferences(row.uiPreferences);
  if (uiPreferences) out.uiPreferences = uiPreferences;

  return out;
}
