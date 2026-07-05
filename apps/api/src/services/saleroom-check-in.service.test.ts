import type { ISaleRegistrationCheckInReader } from "@auction/persistence/interfaces";
import type { ISaleroomCheckInRepository } from "@auction/persistence/interfaces";
import { PaddleTakenError } from "@auction/persistence/interfaces";
import type { ILegalEntityRepository } from "@auction/persistence/interfaces";
import type { LegalEntity } from "@auction/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PaddleService } from "./paddle.service.js";
import { SaleroomCheckInEligibilityValidator } from "./saleroom-check-in-eligibility.validator.js";
import { SaleroomCheckInService } from "./saleroom-check-in.service.js";

const saleId = "00000000-0000-4000-8000-000000000002";
const userId = "00000000-0000-4000-8000-000000000003";
const entityId = "00000000-0000-4000-8000-0000000000e1";
const staffId = "00000000-0000-4000-8000-0000000000f1";
const registrationId = "00000000-0000-4000-8000-0000000000a1";

function mockReader(
  sale: { deliveryMode: string; status: string } | null,
  user: {
    emailVerified: boolean;
    kycStatus: string;
    suspendedAt: Date | null;
  } | null,
): ISaleRegistrationCheckInReader {
  return {
    findSaleForCheckIn: vi
      .fn()
      .mockResolvedValue(
        sale ? { id: saleId, deliveryMode: sale.deliveryMode, status: sale.status } : null,
      ),
    findUserForCheckIn: vi.fn().mockResolvedValue(
      user
        ? {
            id: userId,
            emailVerified: user.emailVerified,
            kycStatus: user.kycStatus,
            suspendedAt: user.suspendedAt,
          }
        : null,
    ),
  };
}

function mockRepo(overrides: Partial<ISaleroomCheckInRepository> = {}): ISaleroomCheckInRepository {
  return {
    searchCandidates: vi.fn().mockResolvedValue([]),
    checkInWithPaddle: vi.fn().mockResolvedValue({
      registrationId,
      paddleNumber: 205,
      checkedInAt: new Date("2026-06-15T12:00:00.000Z"),
    }),
    ...overrides,
  };
}

function mockLegalEntityRepo(
  overrides: Partial<ILegalEntityRepository> = {},
): ILegalEntityRepository {
  const entity = {
    id: entityId,
    displayName: "Jane Collector",
    legalName: null,
    slug: "jane",
    kind: "individual" as const,
    subkind: "private_collector" as const,
    createdByUserId: userId,
    status: "approved" as const,
    statusChangedAt: null,
    statusChangedByUserId: null,
    stripeConnectAccountId: null,
    stripeCustomerId: null,
    stripeConnectChargesEnabled: false,
    stripeConnectPayoutsEnabled: false,
    stripeConnectRequirementsCurrentlyDue: [],
    stripeConnectRequirementsErrors: [],
    stripeConnectDisabledReason: null,
    xeroContactId: null,
    vatNumber: null,
    marginSchemeEligible: false,
    isLaxManaged: false,
    platformFeeBps: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } satisfies LegalEntity;
  return {
    findById: vi.fn().mockResolvedValue(entity),
    findByIds: vi.fn(),
    listActiveMembershipsForUser: vi.fn(),
    findActiveMembership: vi.fn().mockResolvedValue({
      legalEntityId: entityId,
      userId,
      role: "owner",
      isPrimaryAdmin: true,
    }),
    listImpersonationNoticeRecipientEmails: vi.fn(),
    setXeroContactId: vi.fn(),
    setStripeCustomerId: vi.fn(),
    findPrimaryAddressForXero: vi.fn(),
    ...overrides,
  } as ILegalEntityRepository;
}

function mockPaddleService(overrides: Partial<PaddleService> = {}): PaddleService {
  return {
    invalidateRosterCache: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as PaddleService;
}

function buildService(
  sale: { deliveryMode: string; status: string } | null,
  user: {
    emailVerified: boolean;
    kycStatus: string;
    suspendedAt: Date | null;
  } | null,
  repoOverrides: Partial<ISaleroomCheckInRepository> = {},
  legalEntityOverrides: Partial<ILegalEntityRepository> = {},
) {
  const eligibility = new SaleroomCheckInEligibilityValidator(
    mockReader(sale, user),
    mockLegalEntityRepo(legalEntityOverrides),
  );
  return new SaleroomCheckInService(mockRepo(repoOverrides), eligibility, mockPaddleService());
}

describe("SaleroomCheckInService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("checkInBidder happy path assigns paddle", async () => {
    const paddleService = mockPaddleService();
    const eligibility = new SaleroomCheckInEligibilityValidator(
      mockReader(
        { deliveryMode: "hybrid", status: "active" },
        {
          emailVerified: true,
          kycStatus: "approved",
          suspendedAt: null,
        },
      ),
      mockLegalEntityRepo(),
    );
    const svc = new SaleroomCheckInService(mockRepo(), eligibility, paddleService);

    const result = await svc.checkInBidder({
      saleId,
      userId,
      buyerLegalEntityId: entityId,
      decidedByUserId: staffId,
      bidLimit: 50000,
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.paddleNumber).toBe(205);
      expect(result.value.registrationId).toBe(registrationId);
    }
    expect(paddleService.invalidateRosterCache).toHaveBeenCalledWith(saleId);
  });

  it("rejects non-saleroom sale", async () => {
    const svc = buildService(
      { deliveryMode: "online", status: "active" },
      {
        emailVerified: true,
        kycStatus: "approved",
        suspendedAt: null,
      },
    );

    const result = await svc.checkInBidder({
      saleId,
      userId,
      buyerLegalEntityId: entityId,
      decidedByUserId: staffId,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("sale_not_saleroom");
    }
  });

  it("rejects when KYC not approved", async () => {
    const svc = buildService(
      { deliveryMode: "hybrid", status: "active" },
      {
        emailVerified: true,
        kycStatus: "pending",
        suspendedAt: null,
      },
    );

    const result = await svc.checkInBidder({
      saleId,
      userId,
      buyerLegalEntityId: entityId,
      decidedByUserId: staffId,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("kyc_required");
    }
  });

  it("allows connect_pending buyer entity to check in", async () => {
    const svc = buildService(
      { deliveryMode: "hybrid", status: "active" },
      {
        emailVerified: true,
        kycStatus: "approved",
        suspendedAt: null,
      },
      {},
      {
        findById: vi.fn().mockResolvedValue({
          id: entityId,
          displayName: "Jane Collector",
          legalName: null,
          slug: "jane",
          kind: "individual" as const,
          subkind: "private_collector" as const,
          createdByUserId: userId,
          status: "connect_pending" as const,
          statusChangedAt: null,
          statusChangedByUserId: null,
          stripeConnectAccountId: null,
          stripeCustomerId: null,
          stripeConnectChargesEnabled: false,
          stripeConnectPayoutsEnabled: false,
          stripeConnectRequirementsCurrentlyDue: [],
          stripeConnectRequirementsErrors: [],
          stripeConnectDisabledReason: null,
          xeroContactId: null,
          vatNumber: null,
          marginSchemeEligible: false,
          isLaxManaged: false,
          platformFeeBps: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      },
    );

    const result = await svc.checkInBidder({
      saleId,
      userId,
      buyerLegalEntityId: entityId,
      decidedByUserId: staffId,
    });

    expect(result.isOk()).toBe(true);
  });

  it("rejects under_review buyer entity", async () => {
    const svc = buildService(
      { deliveryMode: "hybrid", status: "active" },
      {
        emailVerified: true,
        kycStatus: "approved",
        suspendedAt: null,
      },
      {},
      {
        findById: vi.fn().mockResolvedValue({
          id: entityId,
          displayName: "Jane Collector",
          legalName: null,
          slug: "jane",
          kind: "individual" as const,
          subkind: "private_collector" as const,
          createdByUserId: userId,
          status: "under_review" as const,
          statusChangedAt: null,
          statusChangedByUserId: null,
          stripeConnectAccountId: null,
          stripeCustomerId: null,
          stripeConnectChargesEnabled: false,
          stripeConnectPayoutsEnabled: false,
          stripeConnectRequirementsCurrentlyDue: [],
          stripeConnectRequirementsErrors: [],
          stripeConnectDisabledReason: null,
          xeroContactId: null,
          vatNumber: null,
          marginSchemeEligible: false,
          isLaxManaged: false,
          platformFeeBps: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      },
    );

    const result = await svc.checkInBidder({
      saleId,
      userId,
      buyerLegalEntityId: entityId,
      decidedByUserId: staffId,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("entity_not_authorised");
    }
  });

  it("forwards an explicit paddle number to the repository", async () => {
    const checkInWithPaddle = vi.fn().mockResolvedValue({
      registrationId,
      paddleNumber: 142,
      checkedInAt: new Date("2026-06-15T12:00:00.000Z"),
    });
    const svc = buildService(
      { deliveryMode: "hybrid", status: "active" },
      {
        emailVerified: true,
        kycStatus: "approved",
        suspendedAt: null,
      },
      { checkInWithPaddle },
    );

    const result = await svc.checkInBidder({
      saleId,
      userId,
      buyerLegalEntityId: entityId,
      decidedByUserId: staffId,
      paddleNumber: 142,
    });

    expect(result.isOk()).toBe(true);
    expect(checkInWithPaddle).toHaveBeenCalledWith(
      expect.objectContaining({ requestedPaddleNumber: 142 }),
    );
  });

  it("auto-assigns (null requestedPaddleNumber) when none is provided", async () => {
    const checkInWithPaddle = vi.fn().mockResolvedValue({
      registrationId,
      paddleNumber: 205,
      checkedInAt: new Date("2026-06-15T12:00:00.000Z"),
    });
    const svc = buildService(
      { deliveryMode: "hybrid", status: "active" },
      {
        emailVerified: true,
        kycStatus: "approved",
        suspendedAt: null,
      },
      { checkInWithPaddle },
    );

    const result = await svc.checkInBidder({
      saleId,
      userId,
      buyerLegalEntityId: entityId,
      decidedByUserId: staffId,
      bidLimit: 1000,
    });

    expect(result.isOk()).toBe(true);
    expect(checkInWithPaddle).toHaveBeenCalledWith(
      expect.objectContaining({ requestedPaddleNumber: null }),
    );
  });

  it("mark present without paddle forwards assignPaddle false", async () => {
    const checkInWithPaddle = vi.fn().mockResolvedValue({
      registrationId,
      paddleNumber: null,
      checkedInAt: new Date("2026-06-15T12:00:00.000Z"),
    });
    const svc = buildService(
      { deliveryMode: "hybrid", status: "active" },
      {
        emailVerified: true,
        kycStatus: "approved",
        suspendedAt: null,
      },
      { checkInWithPaddle },
    );

    const result = await svc.checkInBidder({
      saleId,
      userId,
      buyerLegalEntityId: entityId,
      decidedByUserId: staffId,
      assignPaddle: false,
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.paddleNumber).toBeNull();
    }
    expect(checkInWithPaddle).toHaveBeenCalledWith(
      expect.objectContaining({ assignPaddle: false, requestedPaddleNumber: null }),
    );
  });

  it("maps paddle conflict to paddle_taken", async () => {
    const svc = buildService(
      { deliveryMode: "hybrid", status: "active" },
      {
        emailVerified: true,
        kycStatus: "approved",
        suspendedAt: null,
      },
      {
        checkInWithPaddle: vi.fn().mockRejectedValue(new PaddleTakenError()),
      },
    );

    const result = await svc.checkInBidder({
      saleId,
      userId,
      buyerLegalEntityId: entityId,
      decidedByUserId: staffId,
      paddleNumber: 142,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("paddle_taken");
      expect(result.error.status).toBe(409);
    }
  });
});
