import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { user } from "./schema/auth.js";
import { bidUserProfile } from "./schema/bid-user-profile.js";

/** Bid-owned profile fields previously mirrored on `user` (D13). */
const BID_PROFILE_FIELDS = [
  "firstName",
  "lastName",
  "mobile",
  "mobileCountry",
  "role",
  "staffRole",
  "emailStatus",
  "emailStatusChangedAt",
  "suspendedAt",
  "suspendedReason",
  "kycStatus",
  "currentKycSessionId",
  "kycRetryCount",
  "kycVerifiedAt",
  "preferredPaddleNumber",
  "amlHoldStatus",
  "amlHoldReason",
  "amlHoldAt",
  "signupPersona",
  "dateOfBirth",
  "hasSeenActingContextTooltip",
] as const satisfies readonly (keyof typeof bidUserProfile.$inferSelect)[];

/** Maps each remaining `user` column to Identity vs shared ownership (D13). */
const USER_FIELD_OWNERSHIP = {
  id: "identity",
  name: "identity",
  email: "identity",
  emailVerified: "identity",
  image: "identity",
  phoneNumber: "identity",
  phoneNumberVerified: "identity",
  twoFactorEnabled: "identity",
  pendingNewEmail: "identity",
  emailChangeOldOk: "identity",
  emailChangeNewOk: "identity",
  emailChangeExpiresAt: "identity",
  deletionRequestedAt: "identity",
  identityDisabledAt: "identity",
  identityDisabledReason: "identity",
  mergedIntoSubjectId: "identity",
  createdAt: "identity",
  updatedAt: "shared",
} as const satisfies Record<keyof typeof user.$inferSelect, "identity" | "shared">;

describe("identity field ownership contract", () => {
  it("maps every user column to identity or shared", () => {
    const columns = Object.keys(getTableColumns(user));
    for (const column of columns) {
      expect(column in USER_FIELD_OWNERSHIP, `missing ownership for user.${column}`).toBe(true);
    }
  });

  it("keeps user identity-only with no bid-owned columns", () => {
    for (const [field, owner] of Object.entries(USER_FIELD_OWNERSHIP)) {
      expect(owner, `user.${field}`).not.toBe("bid");
    }
  });

  it("represents every bid-owned profile field in bid_user_profile", () => {
    const profileColumns = new Set(Object.keys(getTableColumns(bidUserProfile)));
    for (const field of BID_PROFILE_FIELDS) {
      expect(profileColumns.has(field), `bid_user_profile.${field}`).toBe(true);
    }
  });
});
