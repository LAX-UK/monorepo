import type { AdminUserDetailPayload } from "@/lib/data/http/admin.server";
import type { AdminAmlScreeningRow } from "@/lib/data/http/compliance.server";
import type { LegalEntity } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  buildAdminUserReadinessNextAction,
  buildAdminUserReadinessSnapshot,
  buildUserAttentionItems,
} from "./admin-user-readiness.vm";

const baseUser: AdminUserDetailPayload = {
  id: "user-1",
  email: "client@example.com",
  name: "Client User",
  firstName: "Client",
  lastName: "User",
  role: "user",
  staffRole: null,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-06-01T00:00:00.000Z",
  suspendedAt: null,
  image: null,
  mobile: null,
  mobileCountry: null,
  emailVerified: true,
  emailStatus: "ok",
  signupPersona: "individual",
  securityStatusAvailable: true,
  twoFactorEnabled: false,
  kycStatus: "approved",
  kycVerifiedAt: "2024-02-01T00:00:00.000Z",
  kycRetryCount: 0,
  deletionRequestedAt: null,
  suspendedReason: null,
  dateOfBirth: null,
  emailStatusChangedAt: null,
  pendingNewEmail: null,
  emailChangeExpiresAt: null,
  currentKycSessionId: null,
  amlHoldStatus: "none",
  amlHoldReason: null,
  amlHoldAt: null,
};

const baseInput = {
  user: baseUser,
  legalEntities: [] as LegalEntity[],
  amlScreenings: [] as AdminAmlScreeningRow[],
  lotsWon: 0,
  lifetimeSpend: 0,
  canViewAml: true,
};

describe("buildAdminUserReadinessNextAction", () => {
  it("prioritizes suspended account", () => {
    const action = buildAdminUserReadinessNextAction({
      ...baseInput,
      user: { ...baseUser, suspendedAt: "2024-03-01T00:00:00.000Z" },
    });
    expect(action.tone).toBe("blocked");
    expect(action.label).toMatch(/suspended/i);
  });

  it("recommends AML review when screening is pending", () => {
    const action = buildAdminUserReadinessNextAction({
      ...baseInput,
      amlScreenings: [
        {
          id: "aml-1",
          userId: "user-1",
          providerSessionId: "sess-1",
          matchStatus: "possible_match",
          monitorStatus: "active",
          totalHits: 1,
          categories: ["pep"],
          hits: [],
          checkType: "initial",
          decisionOutcome: "pending",
          reviewStatus: "pending",
          triageRecommendation: null,
          triagedByUserId: null,
          triagedAt: null,
          triageNotes: null,
          reviewedByUserId: null,
          reviewedAt: null,
          reviewNotes: null,
          screenedAt: "2024-05-01T00:00:00.000Z",
          createdAt: "2024-05-01T00:00:00.000Z",
        },
      ],
    });
    expect(action.label).toMatch(/review aml screening/i);
    expect(action.href).toBe("?tab=overview#aml");
  });

  it("returns ready when no blocking issues", () => {
    const action = buildAdminUserReadinessNextAction(baseInput);
    expect(action.tone).toBe("ready");
    expect(action.label).toMatch(/ready/i);
  });
});

describe("buildAdminUserReadinessSnapshot", () => {
  it("preserves unavailable security status instead of deriving 2FA off", () => {
    const snapshot = buildAdminUserReadinessSnapshot({
      ...baseInput,
      user: { ...baseUser, securityStatusAvailable: false, twoFactorEnabled: false },
    });

    expect(snapshot.identity).toMatchObject({
      securityStatusAvailable: false,
      twoFactorEnabled: false,
    });
  });
});

describe("buildUserAttentionItems", () => {
  it("surfaces deletion request in banner and next action", () => {
    const input = {
      ...baseInput,
      user: { ...baseUser, deletionRequestedAt: "2024-04-01T00:00:00.000Z" },
    };

    expect(buildUserAttentionItems(input).some((item) => item.id === "deletion-requested")).toBe(
      true,
    );
    expect(buildAdminUserReadinessNextAction(input).label).toMatch(/deletion requested/i);
  });

  it("keeps suspended ahead of email verification", () => {
    const items = buildUserAttentionItems({
      ...baseInput,
      user: {
        ...baseUser,
        suspendedAt: "2024-03-01T00:00:00.000Z",
        emailVerified: false,
      },
    });

    expect(items[0]?.id).toBe("suspended");
    expect(items.some((item) => item.id === "email-unverified")).toBe(true);
  });
});
