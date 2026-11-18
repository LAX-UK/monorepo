import { listDomainEventTypesForConsumer } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import type { WorkerEnv } from "../../env.js";
import { CRM_ENTITY } from "./crm-field-constants.js";
import { CrmSyncService } from "./crm-sync-service.js";
import { InMemoryCrmLinkRepo, fakeCrmGateway } from "./crm-test-doubles.js";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const FULFILMENT_ID = "22222222-2222-4222-8222-222222222222";
const REFUND_ID = "33333333-3333-4333-8333-333333333333";
const DEAL_ENTITY_ID = `shop-order:${ORDER_ID}`;

function setup() {
  const gateway = fakeCrmGateway();
  const linkRepo = new InMemoryCrmLinkRepo();
  const service = new CrmSyncService({
    gateway,
    linkRepo,
    env: {
      ZOHO_CRM_SYNC_MODE: "live",
      ZOHO_CRM_ENABLED_EVENT_TYPES: "shop.refund.completed,shop.fulfilment.status_changed",
    } as WorkerEnv,
    mapperContext: {
      leadStatusNew: "New (Unassigned)",
      auctionPipeline: "Auction",
      dealStageLotWon: "Won",
      dealStagePaymentCaptured: "Paid",
      dealStagePaymentRefunded: "Refunded",
      dealStageShopPaid: "Shop Paid",
    },
    paymentLotReader: { findLotIdForPayment: vi.fn() },
    attributionReader: { loadFirstTouchFields: vi.fn() },
    enquiryReader: { findById: vi.fn() },
    dealNamingReader: { forLotWon: vi.fn(), forShopOrder: vi.fn() },
    shopEnquiryReader: { find: vi.fn() },
  });
  return { gateway, linkRepo, service };
}

async function seedDeal(linkRepo: InMemoryCrmLinkRepo, zohoModule: "Deals" | "__held__") {
  await linkRepo.upsertLink({
    entityType: CRM_ENTITY.deal,
    entityId: DEAL_ENTITY_ID,
    zohoModule,
    zohoRecordId: zohoModule === "Deals" ? "deal-9" : "__none__",
    subjectId: "sub-1",
    ...(zohoModule === "__held__"
      ? {
          heldPayload: {
            fields: { Deal_Name: "Order", Stage: "Shop Paid" },
            purchase: { product: "LAX Shop", paid: true },
          },
        }
      : {}),
  });
}

const refundCompleted = (status: "succeeded" | "failed") => ({
  id: 10,
  eventType: "shop.refund.completed",
  aggregateId: REFUND_ID,
  schemaVersion: 1,
  payload: { schemaVersion: 1, refundId: REFUND_ID, orderId: ORDER_ID, status },
});

const fulfilmentStatus = (status: string, id = 20) => ({
  id,
  eventType: "shop.fulfilment.status_changed",
  aggregateId: FULFILMENT_ID,
  schemaVersion: 1,
  payload: { schemaVersion: 1, fulfilmentId: FULFILMENT_ID, orderId: ORDER_ID, status },
});

describe("Shop refund and fulfilment events reach the CRM consumer", () => {
  it("lists them for the zoho consumer", () => {
    const types = listDomainEventTypesForConsumer("zoho");
    expect(types).toContain("shop.refund.completed");
    expect(types).toContain("shop.fulfilment.status_changed");
  });
});

describe("CrmSyncService shop.refund.completed", () => {
  it("moves the Shop order deal to the refunded stage, as a Bid refund does", async () => {
    const { gateway, linkRepo, service } = setup();
    await seedDeal(linkRepo, "Deals");

    const result = await service.syncEvent(refundCompleted("succeeded"));

    expect(result.outcome).toBe("success");
    expect(gateway.updateById).toHaveBeenCalledWith({
      module: "Deals",
      recordId: "deal-9",
      fields: { Stage: "Refunded" },
    });
  });

  it("leaves a held deal alone until its buyer has a Contact", async () => {
    const { gateway, linkRepo, service } = setup();
    await seedDeal(linkRepo, "__held__");

    const result = await service.syncEvent(refundCompleted("succeeded"));

    expect(result).toEqual({ outcome: "skipped", reason: "deal_held_until_contact" });
    expect(gateway.updateById).not.toHaveBeenCalled();
  });

  it("retries a refund that arrives before the paid order's deal exists, then moves the deal", async () => {
    const { gateway, linkRepo, service } = setup();

    const early = await service.syncEvent(refundCompleted("succeeded"));

    expect(early.outcome).toBe("retry");
    expect(early).toMatchObject({ error: { code: "deal_link_missing", retryable: true } });
    expect(gateway.updateById).not.toHaveBeenCalled();

    // The paid event is handled meanwhile and creates the deal; the retried refund now moves it.
    await seedDeal(linkRepo, "Deals");
    const retried = await service.syncEvent(refundCompleted("succeeded"));

    expect(retried.outcome).toBe("success");
    expect(gateway.updateById).toHaveBeenCalledWith({
      module: "Deals",
      recordId: "deal-9",
      fields: { Stage: "Refunded" },
    });
  });

  it("still skips a refund whose deal link was erased", async () => {
    const { gateway, linkRepo, service } = setup();
    await seedDeal(linkRepo, "Deals");
    await linkRepo.markErased(CRM_ENTITY.deal, DEAL_ENTITY_ID);

    const result = await service.syncEvent(refundCompleted("succeeded"));

    expect(result).toEqual({ outcome: "skipped", reason: "deal_link_missing" });
    expect(gateway.updateById).not.toHaveBeenCalled();
  });

  it("skips a refund that failed", async () => {
    const { gateway, linkRepo, service } = setup();
    await seedDeal(linkRepo, "Deals");

    const result = await service.syncEvent(refundCompleted("failed"));

    expect(result).toEqual({ outcome: "skipped", reason: "refund_not_succeeded" });
    expect(gateway.updateById).not.toHaveBeenCalled();
  });
});

describe("CrmSyncService shop.fulfilment.status_changed", () => {
  it.each([
    ["in_transit", "Dispatched"],
    ["delivered", "Delivered"],
    ["collected", "Collected"],
  ])("adds a %s note to the Shop order deal once", async (status, title) => {
    const { gateway, linkRepo, service } = setup();
    await seedDeal(linkRepo, "Deals");

    const first = await service.syncEvent(fulfilmentStatus(status));
    const replay = await service.syncEvent(fulfilmentStatus(status, 21));

    expect(first.outcome).toBe("success");
    expect(replay.outcome).toBe("success");
    expect(gateway.createRecord).toHaveBeenCalledTimes(1);
    expect(gateway.createRecord).toHaveBeenCalledWith({
      module: "Notes",
      fields: {
        Note_Title: `Shop order ${title.toLowerCase()}`,
        Note_Content: `Shop order fulfilment: ${title}`,
        Parent_Id: { id: "deal-9", module: { api_name: "Deals" } },
      },
    });
  });

  it("does not add the note twice when the ledger write fails after Zoho added it", async () => {
    const { gateway, linkRepo, service } = setup();
    await seedDeal(linkRepo, "Deals");
    const upsertLink = linkRepo.upsertLink.bind(linkRepo);
    const spy = vi.spyOn(linkRepo, "upsertLink").mockImplementation(async (input) => {
      if (input.entityType === CRM_ENTITY.note && input.zohoModule === "Notes") {
        throw new Error("db_down");
      }
      return upsertLink(input);
    });

    const failed = await service.syncEvent(fulfilmentStatus("delivered"));
    expect(failed.outcome).not.toBe("success");
    spy.mockRestore();
    const retried = await service.syncEvent(fulfilmentStatus("delivered", 21));

    expect(gateway.createRecord).toHaveBeenCalledTimes(1);
    expect(retried).toEqual({ outcome: "skipped", reason: "deal_note_maybe_added" });
  });

  it("sends the note again when Zoho refused it the first time", async () => {
    const { gateway, linkRepo, service } = setup();
    await seedDeal(linkRepo, "Deals");
    gateway.createRecord.mockResolvedValueOnce({
      module: "Notes",
      recordId: "",
      action: "insert",
      status: "error",
      code: "INVALID_DATA",
    });

    expect(await service.syncEvent(fulfilmentStatus("delivered"))).toMatchObject({
      outcome: "fatal",
      error: { code: "INVALID_DATA" },
    });
    const retried = await service.syncEvent(fulfilmentStatus("delivered", 21));

    expect(retried.outcome).toBe("success");
    expect(gateway.createRecord).toHaveBeenCalledTimes(2);
    const note = await linkRepo.findByEntity(
      CRM_ENTITY.note,
      `fulfilment:${FULFILMENT_ID}:delivered`,
    );
    expect(note).toMatchObject({
      zohoModule: "Notes",
      zohoRecordId: expect.stringMatching(/^notes-/),
    });
  });

  it("skips statuses that are not a milestone", async () => {
    const { gateway, linkRepo, service } = setup();
    await seedDeal(linkRepo, "Deals");

    const result = await service.syncEvent(fulfilmentStatus("awaiting_dispatch"));

    expect(result).toEqual({ outcome: "skipped", reason: "fulfilment_status_not_milestone" });
    expect(gateway.createRecord).not.toHaveBeenCalled();
  });

  it("leaves a held deal alone until its buyer has a Contact", async () => {
    const { gateway, linkRepo, service } = setup();
    await seedDeal(linkRepo, "__held__");

    const result = await service.syncEvent(fulfilmentStatus("in_transit"));

    expect(result).toEqual({ outcome: "skipped", reason: "deal_held_until_contact" });
    expect(gateway.createRecord).not.toHaveBeenCalled();
  });

  it("skips when the order has no deal", async () => {
    const { gateway, service } = setup();

    const result = await service.syncEvent(fulfilmentStatus("delivered"));

    expect(result).toEqual({ outcome: "skipped", reason: "deal_link_missing" });
    expect(gateway.createRecord).not.toHaveBeenCalled();
  });

  it("skips a deal whose buyer asked for deletion", async () => {
    const { gateway, linkRepo, service } = setup();
    await seedDeal(linkRepo, "Deals");
    await linkRepo.seedSubject("sub-1", "Contacts", "contact-1");
    await linkRepo.setDeletionRequested(CRM_ENTITY.subject, "sub-1");

    const result = await service.syncEvent(fulfilmentStatus("delivered"));

    expect(result).toEqual({ outcome: "skipped", reason: "deletion_requested" });
    expect(gateway.createRecord).not.toHaveBeenCalled();
  });
});
