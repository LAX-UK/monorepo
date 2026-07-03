import type { LegalEntity } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import type { ISaleRegistrationRepository } from "../repositories/interfaces/sale-registration.repository.js";
import type { ILegalEntityRepository } from "./interfaces/legal-entity-repository.js";
import type { ISaleRepository } from "./interfaces/repositories.js";
import { SaleRegistrationBuyerService } from "./sale-registration/sale-registration-buyer.service.js";
import { createSaleRegistrationContext } from "./sale-registration/sale-registration-context.js";

const saleId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const userId = "user-1";
const leId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const baseEntity: LegalEntity = {
  id: leId,
  displayName: "Acme",
  legalName: null,
  slug: null,
  kind: "organisation",
  subkind: "gallery",
  createdByUserId: userId,
  status: "approved",
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
};

function createBuyerService(input: {
  saleRepo: ISaleRepository;
  registrationRepo: ISaleRegistrationRepository;
  legalEntityRepository: ILegalEntityRepository;
}) {
  const ctx = createSaleRegistrationContext({
    db: {} as never,
    saleRepo: input.saleRepo,
    registrationRepo: input.registrationRepo,
    legalEntityRepository: input.legalEntityRepository,
  });
  return new SaleRegistrationBuyerService(ctx);
}

describe("SaleRegistrationBuyerService.requestRegistration", () => {
  it("returns no_registration_required for non-buyer_agent membership", async () => {
    const repo = {
      findActiveMembership: vi.fn().mockResolvedValue({
        legalEntityId: leId,
        userId,
        role: "owner",
        isPrimaryAdmin: true,
      }),
      findById: vi.fn(),
    } as unknown as ILegalEntityRepository;
    const saleRepo = {
      findById: vi.fn().mockResolvedValue({ id: saleId, status: "active" }),
    } as unknown as ISaleRepository;
    const registrationRepo = {
      findBySaleUserEntity: vi.fn(),
      insert: vi.fn(),
    } as unknown as ISaleRegistrationRepository;
    const svc = createBuyerService({ saleRepo, registrationRepo, legalEntityRepository: repo });
    const r = await svc.requestRegistration({
      userId,
      saleId,
      buyerLegalEntityId: leId,
    });
    expect(r.isErr()).toBe(true);
    if (r.isErr()) {
      expect(r.error.code).toBe("no_registration_required");
      expect(r.error.status).toBe(400);
    }
    expect(repo.findById).not.toHaveBeenCalled();
  });

  it("creates pending registration for buyer_agent", async () => {
    const insertedRow = {
      id: "reg-new",
      saleId,
      userId,
      buyerLegalEntityId: leId,
      status: "pending" as const,
      requestedAt: new Date(),
      decidedAt: null,
      decidedByUserId: null,
      bidLimit: null,
      laxNotes: null,
      rejectionReason: null,
      paddleNumber: null,
      checkedInAt: null,
    };
    const repo = {
      findActiveMembership: vi.fn().mockResolvedValue({
        legalEntityId: leId,
        userId,
        role: "buyer_agent",
        isPrimaryAdmin: false,
      }),
      findById: vi.fn().mockResolvedValue(baseEntity),
    } as unknown as ILegalEntityRepository;
    const saleRepo = {
      findById: vi.fn().mockResolvedValue({ id: saleId, status: "active" }),
    } as unknown as ISaleRepository;
    const insert = vi.fn().mockResolvedValue(insertedRow);
    const registrationRepo = {
      findBySaleUserEntity: vi.fn().mockResolvedValue(null),
      insert,
    } as unknown as ISaleRegistrationRepository;
    const svc = createBuyerService({ saleRepo, registrationRepo, legalEntityRepository: repo });
    const r = await svc.requestRegistration({
      userId,
      saleId,
      buyerLegalEntityId: leId,
    });
    expect(r.isOk()).toBe(true);
    if (r.isOk()) {
      expect(r.value.status).toBe("pending");
      expect(r.value.id).toBe("reg-new");
    }
    expect(insert).toHaveBeenCalled();
  });
});
