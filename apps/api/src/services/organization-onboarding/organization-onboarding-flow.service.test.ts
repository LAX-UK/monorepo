import { describe, expect, it, vi } from "vitest";
import { OrganizationOnboardingFlowService } from "./organization-onboarding-flow.service.js";

const ENTITY_ROW = {
  id: "00000000-0000-4000-8000-000000000001",
  kind: "organisation" as const,
  status: "docs_received" as const,
  subkind: "gallery" as const,
  displayName: "X",
  legalName: null,
  slug: null,
  createdByUserId: "u1",
  statusChangedAt: null,
  statusChangedByUserId: null,
  stripeConnectAccountId: null,
  stripeConnectChargesEnabled: false,
  stripeConnectPayoutsEnabled: false,
  stripeConnectRequirementsCurrentlyDue: [],
  stripeConnectDisabledReason: null,
  xeroContactId: null,
  vatNumber: null,
  marginSchemeEligible: false,
  isLaxManaged: false,
  platformFeeBps: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("OrganizationOnboardingFlowService.submitForReview", () => {
  it("returns invalid_transition when entity is not in lead", async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([ENTITY_ROW]),
          }),
        }),
      }),
    } as never;

    const legalEntityRepository = {
      findActiveMembership: vi.fn().mockResolvedValue({ role: "owner" }),
    } as never;

    const organizationOnboardingService = {
      getRequirements: vi.fn(),
    } as never;

    const publisher = { publish: vi.fn() } as never;

    const svc = new OrganizationOnboardingFlowService(
      db,
      legalEntityRepository,
      organizationOnboardingService,
      publisher,
    );

    const res = await svc.submitForReview("u1", ENTITY_ROW.id);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("invalid_transition");
    }
  });
});
