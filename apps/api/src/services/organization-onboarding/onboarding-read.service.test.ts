import { describe, expect, it, vi } from "vitest";
import type { OnboardingContext } from "./onboarding-context.js";
import { OnboardingReadService } from "./onboarding-read.service.js";

const row = {
  id: "e1",
  displayName: "Acme",
  legalName: "Acme Ltd",
  slug: "acme",
  kind: "organisation",
  subkind: "gallery",
  createdByUserId: "staff-created-1",
  status: "docs_requested",
  statusChangedAt: null,
  statusChangedByUserId: "staff-changed-1",
  statusReason: "Internal: failed enhanced checks",
  stripeConnectAccountId: "acct_secret_1",
  stripeCustomerId: "cus_secret_1",
  stripeConnectChargesEnabled: false,
  stripeConnectPayoutsEnabled: false,
  stripeConnectRequirementsCurrentlyDue: [],
  stripeConnectRequirementsErrors: [],
  stripeConnectDisabledReason: null,
  xeroContactId: "xero-secret-1",
  vatNumber: null,
  marginSchemeEligible: false,
  isLaxManaged: false,
  platformFeeBps: 1234,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("OnboardingReadService", () => {
  it("gives a member the organisation without any staff-only field or value", async () => {
    const ctx = {
      legalEntityRepository: { findActiveMembership: vi.fn().mockResolvedValue({ role: "owner" }) },
      onboardingRepo: {
        findOrganisationById: vi.fn().mockResolvedValue(row),
        listCompletedStepKeys: vi.fn().mockResolvedValue([]),
        listDocuments: vi.fn().mockResolvedValue([]),
        findRegisteredOfficeAddress: vi.fn().mockResolvedValue(null),
      },
    } as unknown as OnboardingContext;
    const result = await new OnboardingReadService(ctx).getOnboarding("u1", "e1");
    const body = JSON.stringify(result);
    for (const secret of [
      "Internal: failed enhanced checks",
      "staff-created-1",
      "staff-changed-1",
      "acct_secret_1",
      "cus_secret_1",
      "xero-secret-1",
      "1234",
    ]) {
      expect(body).not.toContain(secret);
    }
    for (const key of ["statusReason", "xeroContactId", "platformFeeBps", "stripeCustomerId"]) {
      expect(Object.keys(result?.entity ?? {})).not.toContain(key);
    }
  });
});
