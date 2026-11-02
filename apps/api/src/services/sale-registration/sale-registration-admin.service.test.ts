import type { ISaleRegistrationRepository } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import type { IDomainEventSink } from "../domain-event-sink.js";
import { SaleRegistrationAdminService } from "./sale-registration-admin.service.js";
import { createSaleRegistrationContext } from "./sale-registration-context.js";

const SALE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const ENTITY = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const STAFF = "staff-1";

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "reg-1",
    saleId: SALE,
    userId: "user-1",
    buyerLegalEntityId: ENTITY,
    status: "pending",
    bidLimit: null,
    ...overrides,
  };
}

function setup(found: ReturnType<typeof row> | null) {
  const registrationRepo = {
    findByIdAndSale: vi.fn(async () => found),
    setApproved: vi.fn(async () => undefined),
    setRejected: vi.fn(async () => undefined),
    updateBidLimit: vi.fn(async () => undefined),
  };
  const events = {
    publish: vi.fn(async () => undefined),
    withTx: vi.fn(),
  } satisfies IDomainEventSink;
  const ctx = createSaleRegistrationContext({
    registrationRepo: registrationRepo as unknown as ISaleRegistrationRepository,
    saleRepo: {} as never,
    legalEntityRepository: {} as never,
  });
  return { service: new SaleRegistrationAdminService(ctx, events), registrationRepo, events };
}

describe("SaleRegistrationAdminService decisions", () => {
  it("publishes an approval with the bidding limit it carries", async () => {
    const { service, events } = setup(row({ bidLimit: "5000.00" }));
    const result = await service.approve({
      saleId: SALE,
      registrationId: "reg-1",
      decidedByUserId: STAFF,
    });
    expect(result.isOk()).toBe(true);
    expect(events.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregateType: "sale_registration",
        aggregateId: "reg-1",
        eventType: "sale_registration.decided",
        actorUserId: STAFF,
        payload: {
          saleId: SALE,
          userId: "user-1",
          buyerLegalEntityId: ENTITY,
          decision: "approved",
          bidLimit: "5000.00",
        },
      }),
    );
  });

  it("publishes a decline with the reason staff gave", async () => {
    const { service, events } = setup(row());
    await service.reject({
      saleId: SALE,
      registrationId: "reg-1",
      decidedByUserId: STAFF,
      reason: "We could not verify your identity.",
    });
    expect(events.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "sale_registration.decided",
        payload: expect.objectContaining({
          decision: "declined",
          reason: "We could not verify your identity.",
        }),
      }),
    );
  });

  it("publishes nothing when the registration is not pending", async () => {
    const { service, events, registrationRepo } = setup(row({ status: "approved" }));
    const result = await service.approve({
      saleId: SALE,
      registrationId: "reg-1",
      decidedByUserId: STAFF,
    });
    expect(result.isErr()).toBe(true);
    expect(registrationRepo.setApproved).not.toHaveBeenCalled();
    expect(events.publish).not.toHaveBeenCalled();
  });
});

describe("SaleRegistrationAdminService.updateBidLimit", () => {
  it("publishes the previous and new limit", async () => {
    const { service, events } = setup(row({ status: "approved", bidLimit: "1000.00" }));
    await service.updateBidLimit({
      saleId: SALE,
      registrationId: "reg-1",
      bidLimit: 2500,
      decidedByUserId: STAFF,
    });
    expect(events.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "sale_registration.bid_limit_changed",
        payload: expect.objectContaining({ previousLimit: "1000.00", limit: "2500.00" }),
      }),
    );
  });

  it("stays quiet when the limit did not change", async () => {
    const { service, events } = setup(row({ status: "approved", bidLimit: "1000.00" }));
    await service.updateBidLimit({
      saleId: SALE,
      registrationId: "reg-1",
      bidLimit: 1000,
      decidedByUserId: STAFF,
    });
    expect(events.publish).not.toHaveBeenCalled();
  });
});
