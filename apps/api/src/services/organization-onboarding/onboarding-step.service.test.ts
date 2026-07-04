import { describe, expect, it, vi } from "vitest";
import { mockDomainEventSink } from "../../test/domain-event-sink-mock.js";
import type { OnboardingContext } from "./onboarding-context.js";
import { OnboardingStepService } from "./onboarding-step.service.js";

const ENTITY_ID = "00000000-0000-4000-8000-000000000001";

const ENTITY_ROW = {
  id: ENTITY_ID,
  kind: "organisation" as const,
  status: "lead" as const,
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
  vatNumber: "GB123",
  marginSchemeEligible: false,
  isLaxManaged: false,
  platformFeeBps: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function createCtx(overrides: Partial<OnboardingContext> = {}): OnboardingContext {
  return {
    transactionRunner: {
      runInTransaction: async (fn: (tx: never) => Promise<unknown>) => fn({} as never),
    } as never,
    onboardingRepo: {
      findOrganisationById: vi.fn().mockResolvedValue(ENTITY_ROW),
      listCompletedStepKeys: vi.fn().mockResolvedValue([]),
      listDocuments: vi.fn().mockResolvedValue([]),
      findRegisteredOfficeAddress: vi.fn().mockResolvedValue(null),
      hasRegisteredOfficeAddress: vi.fn().mockResolvedValue(true),
      updateProfileWithAddress: vi.fn(),
      markStepComplete: vi.fn().mockResolvedValue(undefined),
      findUserKycStatus: vi.fn(),
      lockOrganisationForUpdate: vi.fn(),
      transitionOrganisationStatus: vi.fn(),
    } as unknown as OnboardingContext["onboardingRepo"],
    uploadPersistenceRepository: {
      findByIdForOwner: vi.fn(),
    } as unknown as OnboardingContext["uploadPersistenceRepository"],
    legalEntityRepository: {
      findActiveMembership: vi.fn().mockResolvedValue({ role: "owner" }),
    } as never,
    organizationOnboardingService: {
      getRequirements: vi.fn().mockReturnValue({
        subkind: "gallery",
        documentKinds: [],
        requiresStripeConnect: true,
        vatRequired: true,
      }),
    } as never,
    domainEventSink: mockDomainEventSink(vi.fn()) as never,
    stripeConnect: null,
    options: {},
    ...overrides,
  };
}

describe("OnboardingStepService.completeStep connect gating", () => {
  it("returns connect_not_started when connect account is missing", async () => {
    const ctx = createCtx();
    const svc = new OnboardingStepService(ctx);

    const res = await svc.completeStep("u1", ENTITY_ID, "connect");
    expect(res).toEqual({ ok: false, code: "connect_not_started" });
  });

  it("syncs Stripe and completes when connect is ready", async () => {
    const syncAccountFromStripe = vi.fn().mockResolvedValue(undefined);
    const markStepComplete = vi.fn().mockResolvedValue(undefined);
    const findOrganisationById = vi
      .fn()
      .mockResolvedValueOnce(ENTITY_ROW)
      .mockResolvedValueOnce({
        ...ENTITY_ROW,
        stripeConnectAccountId: "acct_1",
        stripeConnectPayoutsEnabled: true,
      });

    const ctx = createCtx({
      stripeConnect: {
        isConfigured: () => true,
        syncAccountFromStripe,
      } as never,
      onboardingRepo: {
        ...createCtx().onboardingRepo,
        findOrganisationById,
        markStepComplete,
      },
    });
    const svc = new OnboardingStepService(ctx);

    const res = await svc.completeStep("u1", ENTITY_ID, "connect");
    expect(syncAccountFromStripe).toHaveBeenCalledWith(ENTITY_ID);
    expect(markStepComplete).toHaveBeenCalledWith(ENTITY_ID, "connect");
    expect(res).toEqual({ ok: true });
  });

  it("returns connect_sync_failed when Stripe sync throws", async () => {
    const ctx = createCtx({
      stripeConnect: {
        isConfigured: () => true,
        syncAccountFromStripe: vi.fn().mockRejectedValue(new Error("stripe down")),
      } as never,
    });
    const svc = new OnboardingStepService(ctx);

    const res = await svc.completeStep("u1", ENTITY_ID, "connect");
    expect(res).toEqual({ ok: false, code: "connect_sync_failed" });
  });
});
