import type { ISaleRegistrationCheckInReader } from "@auction/persistence/interfaces";
import type { ILegalEntityRepository } from "@auction/persistence/interfaces";
import type { LegalEntity } from "@auction/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SaleroomCheckInEligibilityValidator } from "./saleroom-check-in-eligibility.validator.js";

const saleId = "00000000-0000-4000-8000-000000000002";
const userId = "00000000-0000-4000-8000-000000000003";
const entityId = "00000000-0000-4000-8000-0000000000e1";

function mockReader(
  overrides: Partial<ISaleRegistrationCheckInReader> = {},
): ISaleRegistrationCheckInReader {
  return {
    findSaleForCheckIn: vi.fn().mockResolvedValue({
      id: saleId,
      deliveryMode: "hybrid",
      status: "active",
    }),
    findUserForCheckIn: vi.fn().mockResolvedValue({
      id: userId,
      emailVerified: true,
      kycStatus: "approved",
      suspendedAt: null,
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

describe("SaleroomCheckInEligibilityValidator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes for eligible sale, user, and entity", async () => {
    const validator = new SaleroomCheckInEligibilityValidator(mockReader(), mockLegalEntityRepo());
    const result = await validator.validate({
      saleId,
      userId,
      buyerLegalEntityId: entityId,
    });
    expect(result.isOk()).toBe(true);
  });

  it("rejects non-saleroom sale", async () => {
    const validator = new SaleroomCheckInEligibilityValidator(
      mockReader({
        findSaleForCheckIn: vi.fn().mockResolvedValue({
          id: saleId,
          deliveryMode: "online",
          status: "active",
        }),
      }),
      mockLegalEntityRepo(),
    );
    const result = await validator.validate({
      saleId,
      userId,
      buyerLegalEntityId: entityId,
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("sale_not_saleroom");
    }
  });

  it("rejects when KYC not approved", async () => {
    const validator = new SaleroomCheckInEligibilityValidator(
      mockReader({
        findUserForCheckIn: vi.fn().mockResolvedValue({
          id: userId,
          emailVerified: true,
          kycStatus: "pending",
          suspendedAt: null,
        }),
      }),
      mockLegalEntityRepo(),
    );
    const result = await validator.validate({
      saleId,
      userId,
      buyerLegalEntityId: entityId,
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("kyc_required");
    }
  });
});
