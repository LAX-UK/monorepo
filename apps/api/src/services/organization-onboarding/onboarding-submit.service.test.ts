import { describe, expect, it, vi } from "vitest";
import { mockDomainEventSink } from "../../test/domain-event-sink-mock.js";
import type { OnboardingContext } from "./onboarding-context.js";
import { OnboardingSubmitService } from "./onboarding-submit.service.js";

const ENTITY_ID = "00000000-0000-4000-8000-000000000001";

const ENTITY_ROW = {
  id: ENTITY_ID,
  kind: "organisation" as const,
  status: "docs_received" as const,
  subkind: "gallery" as const,
  displayName: "Gallery",
  legalName: null,
  slug: null,
  createdByUserId: "u1",
  statusChangedAt: null,
  statusChangedByUserId: null,
  statusReason: null,
  stripeConnectAccountId: null,
  stripeCustomerId: null,
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

const DOCS_REQUESTED_ROW = {
  ...ENTITY_ROW,
  status: "docs_requested" as const,
  statusReason: "Need clearer VAT certificate",
};

function createCtx(overrides: Partial<OnboardingContext> = {}): OnboardingContext {
  return {
    transactionRunner: {
      runInTransaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({})),
    } as never,
    onboardingRepo: {
      findOrganisationById: vi.fn().mockResolvedValue(DOCS_REQUESTED_ROW),
      listCompletedStepKeys: vi
        .fn()
        .mockResolvedValue(["type", "details", "documents", "connect", "identity"]),
      listDocuments: vi.fn(),
      findRegisteredOfficeAddress: vi.fn(),
      hasRegisteredOfficeAddress: vi.fn(),
      updateProfileWithAddress: vi.fn(),
      markStepComplete: vi.fn(),
      findUserKycStatus: vi.fn().mockResolvedValue("approved"),
      lockOrganisationForUpdate: vi.fn().mockResolvedValue(DOCS_REQUESTED_ROW),
      transitionOrganisationStatus: vi.fn().mockResolvedValue(undefined),
    } as unknown as OnboardingContext["onboardingRepo"],
    uploadPersistenceRepository: {
      findByIdForOwner: vi.fn(),
    } as unknown as OnboardingContext["uploadPersistenceRepository"],
    legalEntityRepository: {
      findActiveMembership: vi.fn().mockResolvedValue({ role: "owner" }),
    } as never,
    organizationOnboardingService: { getRequirements: vi.fn() } as never,
    domainEventSink: mockDomainEventSink(vi.fn().mockResolvedValue(undefined)) as never,
    stripeConnect: null,
    options: {},
    ...overrides,
  };
}

describe("OnboardingSubmitService.submitForReview", () => {
  it("returns invalid_transition when entity is not submittable", async () => {
    const ctx = createCtx({
      onboardingRepo: {
        ...createCtx().onboardingRepo,
        findOrganisationById: vi.fn().mockResolvedValue(ENTITY_ROW),
      },
    });
    const svc = new OnboardingSubmitService(ctx);

    const res = await svc.submitForReview("u1", ENTITY_ID);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("invalid_transition");
  });

  it("allows resubmit from docs_requested when steps and KYC are complete", async () => {
    const onSubmittedForReview = vi.fn().mockResolvedValue(undefined);
    const ctx = createCtx({ options: { onSubmittedForReview } });
    const svc = new OnboardingSubmitService(ctx);

    const res = await svc.submitForReview("u1", ENTITY_ID);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.status).toBe("docs_received");
    expect(onSubmittedForReview).toHaveBeenCalled();
  });
});
