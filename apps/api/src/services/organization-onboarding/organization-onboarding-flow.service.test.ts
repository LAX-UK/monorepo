import { describe, expect, it, vi } from "vitest";
import { mockDomainEventSink } from "../../test/domain-event-sink-mock.js";
import { transactionRunnerFromDb } from "../../test/transaction-runner-from-db.js";
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

describe("OrganizationOnboardingFlowService.submitForReview", () => {
  it("returns invalid_transition when entity is not submittable", async () => {
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

    const publisher = mockDomainEventSink(vi.fn()) as never;

    const uploadPersistenceRepository = { findByIdForOwner: vi.fn() } as never;
    const onboardingRepo = {
      findOrganisationById: vi.fn().mockResolvedValue(ENTITY_ROW),
    } as never;

    const svc = new OrganizationOnboardingFlowService(
      transactionRunnerFromDb(db),
      legalEntityRepository,
      organizationOnboardingService,
      publisher,
      uploadPersistenceRepository,
      onboardingRepo,
    );

    const res = await svc.submitForReview("u1", ENTITY_ROW.id);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("invalid_transition");
    }
  });

  it("allows resubmit from docs_requested when steps and KYC are complete", async () => {
    const progressRows = [
      { stepKey: "type" },
      { stepKey: "details" },
      { stepKey: "documents" },
      { stepKey: "connect" },
      { stepKey: "identity" },
    ];
    const selectMock = vi
      .fn()
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([DOCS_REQUESTED_ROW]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(progressRows),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ kycStatus: "approved" }]),
          }),
        }),
      });

    const txUpdate = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    const txSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          for: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([DOCS_REQUESTED_ROW]),
          }),
        }),
      }),
    });

    const db = {
      select: selectMock,
      transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          select: txSelect,
          update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: txUpdate }) }),
          insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
        }),
      ),
    } as never;

    const legalEntityRepository = {
      findActiveMembership: vi.fn().mockResolvedValue({ role: "owner" }),
    } as never;
    const organizationOnboardingService = { getRequirements: vi.fn() } as never;
    const publisher = mockDomainEventSink(vi.fn().mockResolvedValue(undefined)) as never;
    const onSubmittedForReview = vi.fn().mockResolvedValue(undefined);
    const uploadPersistenceRepository = { findByIdForOwner: vi.fn() } as never;
    const onboardingRepo = {
      findOrganisationById: vi.fn().mockResolvedValue(DOCS_REQUESTED_ROW),
      listCompletedStepKeys: vi.fn().mockResolvedValue(progressRows.map((row) => row.stepKey)),
      findUserKycStatus: vi.fn().mockResolvedValue("approved"),
      lockOrganisationForUpdate: vi.fn().mockResolvedValue(DOCS_REQUESTED_ROW),
      transitionOrganisationStatus: vi.fn().mockResolvedValue(undefined),
    } as never;

    const svc = new OrganizationOnboardingFlowService(
      transactionRunnerFromDb(db),
      legalEntityRepository,
      organizationOnboardingService,
      publisher,
      uploadPersistenceRepository,
      onboardingRepo,
      null,
      { onSubmittedForReview },
    );

    const res = await svc.submitForReview("u1", DOCS_REQUESTED_ROW.id);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.status).toBe("docs_received");
    expect(onSubmittedForReview).toHaveBeenCalled();
  });
});
