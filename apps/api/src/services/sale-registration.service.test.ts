import type { LegalEntity } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import type { ILegalEntityRepository } from "./interfaces/legal-entity-repository.js";
import { SaleRegistrationService } from "./sale-registration.service.js";

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

function createDbMock(limitResults: unknown[][]) {
  const queue = [...limitResults];
  const insertReturning = vi.fn();
  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve(queue.shift() ?? [])),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn().mockReturnThis(),
      returning: insertReturning,
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
  };
  return { db, insertReturning };
}

describe("SaleRegistrationService.requestRegistration", () => {
  it("returns no_registration_required for non-buyer_agent membership", async () => {
    const { db } = createDbMock([[{ id: saleId, status: "active" }]]);
    const repo = {
      findActiveMembership: vi.fn().mockResolvedValue({
        legalEntityId: leId,
        userId,
        role: "owner",
        isPrimaryAdmin: true,
      }),
      findById: vi.fn(),
    } as unknown as ILegalEntityRepository;
    const svc = new SaleRegistrationService(db as never, repo);
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
      status: "pending",
      requestedAt: new Date(),
      decidedAt: null,
      decidedByUserId: null,
      bidLimit: null,
      laxNotes: null,
      rejectionReason: null,
    };
    const { db, insertReturning } = createDbMock([[{ id: saleId, status: "active" }], []]);
    insertReturning.mockResolvedValue([insertedRow]);
    const repo = {
      findActiveMembership: vi.fn().mockResolvedValue({
        legalEntityId: leId,
        userId,
        role: "buyer_agent",
        isPrimaryAdmin: false,
      }),
      findById: vi.fn().mockResolvedValue(baseEntity),
    } as unknown as ILegalEntityRepository;
    const svc = new SaleRegistrationService(db as never, repo);
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
    expect(db.insert).toHaveBeenCalled();
  });
});
