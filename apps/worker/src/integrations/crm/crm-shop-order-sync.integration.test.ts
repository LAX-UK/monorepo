import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { DrizzleCrmRecordLinkRepository } from "@auction/persistence/repositories";
import { afterAll, describe, expect, it, vi } from "vitest";
import type { WorkerEnv } from "../../env.js";
import { CRM_ENTITY } from "./crm-field-constants.js";
import { CrmSyncService } from "./crm-sync-service.js";
import { fakeCrmGateway } from "./crm-test-doubles.js";

const workerUrl = process.env.DATABASE_URL_WORKER;

/**
 * Shop refund and fulfilment events against the real delivery ledger, as `worker_app` (the role
 * the CRM projector connects with): the deal stage moves, and a milestone note is written once
 * however often the event is delivered.
 */
describe.skipIf(!workerUrl)("CRM Shop refund and fulfilment sync (integration)", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by skipIf
  const db = createDb(workerUrl!);
  const linkRepo = new DrizzleCrmRecordLinkRepository(db);
  const orderId = randomUUID();
  const fulfilmentId = randomUUID();
  const subjectId = `sub-${randomUUID()}`;
  const dealEntityId = `shop-order:${orderId}`;
  const dealRecordId = `deal-${randomUUID()}`;

  afterAll(async () => {
    await linkRepo.markErased(CRM_ENTITY.deal, dealEntityId);
  });

  function service(gateway: ReturnType<typeof fakeCrmGateway>) {
    return new CrmSyncService({
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
      shopRefundReader: {
        findById: vi.fn(async () => ({
          amountPence: 1000,
          refundedTotalPence: 1000,
          orderTotalPence: 1000,
        })),
      },
      dealSourceReader: { isDeliveryInFlight: vi.fn().mockResolvedValue(false) },
    });
  }

  it("adds one dispatched note to the deal and moves it to refunded", async () => {
    await linkRepo.upsertLink({
      entityType: CRM_ENTITY.deal,
      entityId: dealEntityId,
      zohoModule: "Deals",
      zohoRecordId: dealRecordId,
      subjectId,
    });
    const gateway = fakeCrmGateway();
    const sync = service(gateway);
    const dispatched = (id: number) => ({
      id,
      eventType: "shop.fulfilment.status_changed",
      aggregateId: fulfilmentId,
      schemaVersion: 1,
      payload: { schemaVersion: 1, fulfilmentId, orderId, status: "in_transit" },
    });

    expect((await sync.syncEvent(dispatched(1))).outcome).toBe("success");
    expect((await sync.syncEvent(dispatched(2))).outcome).toBe("success");

    expect(gateway.createRecord).toHaveBeenCalledTimes(1);
    expect(gateway.createRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        module: "Notes",
        fields: expect.objectContaining({
          Parent_Id: { id: dealRecordId, module: { api_name: "Deals" } },
        }),
      }),
    );
    const note = await linkRepo.findByEntity(
      CRM_ENTITY.note,
      `fulfilment:${fulfilmentId}:in_transit`,
    );
    expect(note).toMatchObject({ zohoModule: "Notes", subjectId });

    const refundId = randomUUID();
    const refunded = await sync.syncEvent({
      id: 3,
      eventType: "shop.refund.completed",
      aggregateId: refundId,
      schemaVersion: 1,
      payload: { schemaVersion: 1, refundId, orderId, status: "succeeded" },
    });
    expect(refunded.outcome).toBe("success");
    expect(gateway.updateById).toHaveBeenCalledWith({
      module: "Deals",
      recordId: dealRecordId,
      fields: { Stage: "Refunded" },
    });
  });

  it("finds a note whose ledger write failed after Zoho added it, instead of adding it twice", async () => {
    const gateway = fakeCrmGateway();
    const sync = service(gateway);
    const delivered = (id: number) => ({
      id,
      eventType: "shop.fulfilment.status_changed",
      aggregateId: fulfilmentId,
      schemaVersion: 1,
      payload: { schemaVersion: 1, fulfilmentId, orderId, status: "delivered" },
    });
    const upsertLink = linkRepo.upsertLink.bind(linkRepo);
    const spy = vi.spyOn(linkRepo, "upsertLink").mockImplementation(async (input) => {
      if (input.entityType === CRM_ENTITY.note && input.zohoModule === "Notes") {
        throw new Error("ledger_write_failed");
      }
      return upsertLink(input);
    });

    expect((await sync.syncEvent(delivered(4))).outcome).not.toBe("success");
    spy.mockRestore();
    const pending = {
      zohoModule: "__note_pending__",
      zohoRecordId: "__none__",
      subjectId,
      heldPayload: { dealRecordId, title: "Shop order delivered" },
    };
    // Not found on the deal yet, and claimed moments ago: left to the delivery that claimed it.
    expect(await sync.syncEvent(delivered(5))).toMatchObject({
      outcome: "retry",
      error: { code: "deal_note_in_flight" },
    });
    expect(
      await linkRepo.findByEntity(CRM_ENTITY.note, `fulfilment:${fulfilmentId}:delivered`),
    ).toMatchObject(pending);

    // Found on the deal by its title: recorded, not sent again.
    gateway.findNoteIds.mockResolvedValueOnce(["note-found"]);
    expect((await sync.syncEvent(delivered(6))).outcome).toBe("success");
    expect(gateway.createRecord).toHaveBeenCalledTimes(1);
    expect(
      await linkRepo.findByEntity(CRM_ENTITY.note, `fulfilment:${fulfilmentId}:delivered`),
    ).toMatchObject({ zohoModule: "Notes", zohoRecordId: "note-found", subjectId });
  });
});
