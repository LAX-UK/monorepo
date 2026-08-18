import { readFile } from "node:fs/promises";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { user } from "./schema/auth.js";
import { bidUserProfile } from "./schema/bid-user-profile.js";

/** Maps each `user` column to Identity vs Bid ownership (D13). */
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
  firstName: "bid",
  lastName: "bid",
  mobile: "bid",
  mobileCountry: "bid",
  role: "bid",
  staffRole: "bid",
  emailStatus: "bid",
  emailStatusChangedAt: "bid",
  suspendedAt: "bid",
  suspendedReason: "bid",
  kycStatus: "bid",
  currentKycSessionId: "bid",
  kycRetryCount: "bid",
  kycVerifiedAt: "bid",
  preferredPaddleNumber: "bid",
  amlHoldStatus: "bid",
  amlHoldReason: "bid",
  amlHoldAt: "bid",
  signupPersona: "bid",
  dateOfBirth: "bid",
  hasSeenActingContextTooltip: "bid",
} as const satisfies Record<keyof typeof user.$inferSelect, "identity" | "bid" | "shared">;

describe("identity field ownership contract", () => {
  it("maps every user column to identity, bid, or shared", () => {
    const columns = Object.keys(getTableColumns(user));
    for (const column of columns) {
      expect(column in USER_FIELD_OWNERSHIP, `missing ownership for user.${column}`).toBe(true);
    }
  });

  it("represents every Bid-owned legacy field in bid_user_profile", () => {
    const profileColumns = new Set(Object.keys(getTableColumns(bidUserProfile)));
    for (const [field, owner] of Object.entries(USER_FIELD_OWNERSHIP)) {
      if (owner === "bid") {
        expect(profileColumns.has(field), `bid_user_profile.${field}`).toBe(true);
      }
    }
  });

  it("reconciles every Bid-owned legacy field for drift", async () => {
    const source = await readFile(
      new URL("./scripts/reconcile-identity-profile-drift.ts", import.meta.url),
      "utf8",
    );
    const userColumns = getTableColumns(user);
    for (const [field, owner] of Object.entries(USER_FIELD_OWNERSHIP)) {
      if (owner !== "bid") continue;
      const columnName = userColumns[field as keyof typeof userColumns].name;
      expect(
        new RegExp(`p\\.${columnName}\\s+IS DISTINCT FROM\\s+u\\.${columnName}`).test(source),
        columnName,
      ).toBe(true);
    }
  });
});
