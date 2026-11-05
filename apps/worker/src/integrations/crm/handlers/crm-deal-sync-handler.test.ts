import { describe, expect, it, vi } from "vitest";
import type { CrmMappedIntent } from "../crm-event-mappers.js";
import { CRM_FIELD } from "../crm-field-constants.js";
import { InMemoryCrmLinkRepo, fakeCrmGateway } from "../crm-test-doubles.js";
import { CrmDealSyncHandler } from "./crm-deal-sync-handler.js";
import { CrmPaidBuyerHandler } from "./crm-paid-buyer-handler.js";
import { CrmPersonSyncHandler } from "./crm-person-sync-handler.js";

type DealUpsert = Extract<CrmMappedIntent, { kind: "deal_upsert" }>;

function setup(gatewayOverrides = {}) {
  const gateway = fakeCrmGateway(gatewayOverrides);
  const linkRepo = new InMemoryCrmLinkRepo();
  const handler = new CrmDealSyncHandler({
    gateway,
    linkRepo,
    personHandler: new CrmPersonSyncHandler({ gateway, linkRepo }),
    paidBuyerHandler: new CrmPaidBuyerHandler({
      gateway,
      linkRepo,
      now: () => new Date("2026-11-04T10:00:00Z"),
    }),
  });
  return { gateway, linkRepo, handler };
}

function statusUpdates(gateway: ReturnType<typeof fakeCrmGateway>) {
  return gateway.updateById.mock.calls
    .map((c: unknown[]) => c[0] as { module: string; fields: Record<string, unknown> })
    .filter((c) => c.module === "Leads" && "Lead_Status" in c.fields);
}

const shopOrder: DealUpsert = {
  kind: "deal_upsert",
  subjectId: "sub-1",
  dealEntityId: "shop-order:o1",
  dealKey: "shop-order:o1",
  purchase: { product: "LAX Shop", paid: true },
  fields: {
    Deal_Name: "Shop order o1",
    Amount: 480,
    Stage: "Paid",
    Closing_Date: "2026-11-03",
    [CRM_FIELD.dealExternalKey]: "shop-order:o1",
  },
};

const lotWon: DealUpsert = {
  kind: "deal_upsert",
  subjectId: "sub-1",
  dealEntityId: "lot-won:lot-1",
  dealKey: "lot-won:lot-1",
  purchase: { product: "LAX Bid", paid: false },
  fields: {
    Deal_Name: "Lot won lot-1",
    Amount: 1250,
    Stage: "Lot Won",
    Closing_Date: "2026-11-02",
    [CRM_FIELD.dealExternalKey]: "lot-won:lot-1",
  },
};

describe("CrmDealSyncHandler purchases", () => {
  it("creates the deal on the Contact when the buyer is already a client", async () => {
    const { gateway, linkRepo, handler } = setup();
    await linkRepo.seedSubject("sub-1", "Contacts", "contact-1");

    const result = await handler.syncDeal(shopOrder);

    expect(result.outcome).toBe("success");
    const fields = gateway.upsert.mock.calls[0]?.[0]?.fields as Record<string, unknown>;
    expect(fields.Contact_Name).toEqual({ id: "contact-1" });
    expect(gateway.createRecord).not.toHaveBeenCalled();
    expect((await linkRepo.findByEntity("deal", "shop-order:o1"))?.zohoModule).toBe("Deals");
  });

  it("holds an unpaid lot win for a lead without touching the lead", async () => {
    const { gateway, linkRepo, handler } = setup();
    await linkRepo.seedSubject("sub-1", "Leads", "lead-1");

    const result = await handler.syncDeal(lotWon);

    expect(result.outcome).toBe("success");
    expect(gateway.upsert).not.toHaveBeenCalled();
    expect(gateway.createRecord).not.toHaveBeenCalled();
    const row = await linkRepo.findByEntity("deal", "lot-won:lot-1");
    expect(row?.zohoModule).toBe("__held__");
    expect(row?.subjectId).toBe("sub-1");
    expect(row?.heldPayload).toMatchObject({
      fields: { Deal_Name: "Lot won lot-1" },
      purchase: { product: "LAX Bid", paid: false },
    });
  });

  it("holds a paid Shop order, qualifies the lead, adds a note and a task", async () => {
    const { gateway, linkRepo, handler } = setup({
      findLead: vi.fn(async () => ({
        status: "New (Unassigned)",
        ownerId: "owner-7",
        convertedContactId: null,
      })),
    });
    await linkRepo.seedSubject("sub-1", "Leads", "lead-1");

    await handler.syncDeal(shopOrder);

    // No contactless deal.
    expect(gateway.upsert).not.toHaveBeenCalled();
    expect((await linkRepo.findByEntity("deal", "shop-order:o1"))?.zohoModule).toBe("__held__");

    expect(gateway.updateById).toHaveBeenCalledWith({
      module: "Leads",
      recordId: "lead-1",
      fields: { Lead_Status: "Qualified" },
    });
    const created = gateway.createRecord.mock.calls.map((c) => c[0]);
    const note = created.find((c) => c.module === "Notes");
    expect(note?.fields.Parent_Id).toEqual({ id: "lead-1", module: { api_name: "Leads" } });
    expect(note?.fields.Note_Content).toContain("Shop order o1");
    expect(note?.fields.Note_Content).toContain("Amount: 480.00");
    expect(note?.fields.Note_Content).toContain("Date: 2026-11-03");
    expect(note?.fields.Note_Content).toContain("Product: LAX Shop");
    const task = created.find((c) => c.module === "Tasks");
    expect(task?.fields).toMatchObject({
      Subject: "Paid customer: please convert",
      Due_Date: "2026-11-05",
      Who_Id: { id: "lead-1" },
      Owner: { id: "owner-7" },
    });
    expect((await linkRepo.findByEntity("note", "paid-customer:shop-order:o1"))?.zohoModule).toBe(
      "Notes",
    );
    expect((await linkRepo.findByEntity("task", "paid-customer:shop-order:o1"))?.subjectId).toBe(
      "sub-1",
    );
  });

  it("leaves the default task owner when the lead is unassigned", async () => {
    const { gateway, linkRepo, handler } = setup({
      findLead: vi.fn(async () => ({ status: "New", ownerId: null, convertedContactId: null })),
    });
    await linkRepo.seedSubject("sub-1", "Leads", "lead-1");

    await handler.syncDeal(shopOrder);

    const task = gateway.createRecord.mock.calls.map((c) => c[0]).find((c) => c.module === "Tasks");
    expect(task?.fields.Owner).toBeUndefined();
  });

  it.each(["Not Proceeding", "Converted to Client", "Meeting Booked", "Qualified"])(
    "never changes a lead whose status is %s",
    async (status) => {
      const { gateway, linkRepo, handler } = setup({
        findLead: vi.fn(async () => ({ status, ownerId: null, convertedContactId: null })),
      });
      await linkRepo.seedSubject("sub-1", "Leads", "lead-1");

      await handler.syncDeal(shopOrder);

      expect(statusUpdates(gateway)).toHaveLength(0);
      // The note and the task are still there for the admins.
      expect(gateway.createRecord).toHaveBeenCalledTimes(2);
    },
  );

  it.each(["New", "Assigned", "Contacted"])("qualifies a lead that is %s", async (status) => {
    const { gateway, linkRepo, handler } = setup({
      findLead: vi.fn(async () => ({ status, ownerId: null, convertedContactId: null })),
    });
    await linkRepo.seedSubject("sub-1", "Leads", "lead-1");

    await handler.syncDeal(shopOrder);

    expect(gateway.updateById).toHaveBeenCalledWith(
      expect.objectContaining({ fields: { Lead_Status: "Qualified" } }),
    );
  });

  it("does not double the note or the task when the event is replayed", async () => {
    const { gateway, linkRepo, handler } = setup({
      findLead: vi.fn(async () => ({ status: "New", ownerId: null, convertedContactId: null })),
    });
    await linkRepo.seedSubject("sub-1", "Leads", "lead-1");

    await handler.syncDeal(shopOrder);
    await handler.syncDeal(shopOrder);

    expect(gateway.createRecord).toHaveBeenCalledTimes(2);
  });

  it("qualifies and notes a lot win when the payment is captured", async () => {
    const { gateway, linkRepo, handler } = setup({
      findLead: vi.fn(async () => ({
        status: "Contacted",
        ownerId: null,
        convertedContactId: null,
      })),
    });
    await linkRepo.seedSubject("sub-1", "Leads", "lead-1");
    await handler.syncDeal(lotWon);
    expect(gateway.createRecord).not.toHaveBeenCalled();

    const result = await handler.markPurchasePaid({
      kind: "purchase_paid",
      dealEntityId: "lot-won:lot-1",
      stage: "Paid",
      amount: 1300,
      paidAt: "2026-11-04T09:00:00Z",
    });

    expect(result.outcome).toBe("success");
    const row = await linkRepo.findByEntity("deal", "lot-won:lot-1");
    expect(row?.zohoModule).toBe("__held__");
    expect(row?.heldPayload).toMatchObject({
      fields: { Stage: "Paid", Amount: 1300, Closing_Date: "2026-11-04" },
      purchase: { paid: true },
    });
    expect(gateway.updateById).toHaveBeenCalledWith(
      expect.objectContaining({ fields: { Lead_Status: "Qualified" } }),
    );
    const note = gateway.createRecord.mock.calls.map((c) => c[0]).find((c) => c.module === "Notes");
    expect(note?.fields.Note_Content).toContain("Product: LAX Bid");
    expect(gateway.upsert).not.toHaveBeenCalled();
  });

  it("moves a deal that is already in Zoho to the paid stage", async () => {
    const { gateway, linkRepo, handler } = setup();
    await linkRepo.upsertLink({
      entityType: "deal",
      entityId: "lot-won:lot-1",
      zohoModule: "Deals",
      zohoRecordId: "deal-9",
      subjectId: "sub-1",
    });

    await handler.markPurchasePaid({
      kind: "purchase_paid",
      dealEntityId: "lot-won:lot-1",
      stage: "Paid",
      amount: 1300,
      paidAt: "2026-11-04T09:00:00Z",
    });

    expect(gateway.updateById).toHaveBeenCalledWith({
      module: "Deals",
      recordId: "deal-9",
      fields: { Stage: "Paid" },
    });
    expect(gateway.createRecord).not.toHaveBeenCalled();
  });

  it("skips a payment whose deal was never recorded", async () => {
    const { handler } = setup();
    const result = await handler.markPurchasePaid({
      kind: "purchase_paid",
      dealEntityId: "lot-won:none",
      stage: "Paid",
      amount: 1,
      paidAt: "2026-11-04T09:00:00Z",
    });
    expect(result).toEqual({ outcome: "skipped", reason: "deal_link_missing" });
  });

  it("releases held deals onto the Contact", async () => {
    const { gateway, linkRepo, handler } = setup();
    await linkRepo.seedSubject("sub-1", "Leads", "lead-1");
    await handler.syncDeal(lotWon);
    await linkRepo.seedSubject("sub-1", "Contacts", "contact-5");

    const released = await handler.releaseHeldDealsForSubject("sub-1");

    expect(released).toBe(1);
    const fields = gateway.upsert.mock.calls[0]?.[0]?.fields as Record<string, unknown>;
    expect(fields).toMatchObject({ Deal_Name: "Lot won lot-1", Contact_Name: { id: "contact-5" } });
    const row = await linkRepo.findByEntity("deal", "lot-won:lot-1");
    expect(row?.zohoModule).toBe("Deals");
    expect(row?.heldPayload).toBeNull();
  });

  it("keeps deals held while the subject is still a lead", async () => {
    const { gateway, linkRepo, handler } = setup();
    await linkRepo.seedSubject("sub-1", "Leads", "lead-1");
    await handler.syncDeal(lotWon);

    expect(await handler.releaseHeldDealsForSubject("sub-1")).toBe(0);
    expect(gateway.upsert).not.toHaveBeenCalled();
  });
});

describe("CrmDealSyncHandler guards", () => {
  it("skips deal stage update when subject is deletion-requested", async () => {
    const { gateway, linkRepo, handler } = setup();
    await linkRepo.upsertLink({
      entityType: "deal",
      entityId: "lot-won:lot-1",
      zohoModule: "Deals",
      zohoRecordId: "deal-1",
      subjectId: "sub-1",
    });
    await linkRepo.seedSubject("sub-1", "Contacts", "contact-1");
    await linkRepo.setDeletionRequested("subject", "sub-1");

    const result = await handler.updateDealStage("lot-won:lot-1", "Paid");
    expect(result).toEqual({ outcome: "skipped", reason: "deletion_requested" });
    expect(gateway.updateById).not.toHaveBeenCalled();
  });

  it("skips when subject is deletion-requested", async () => {
    const { linkRepo, handler } = setup();
    await linkRepo.seedSubject("sub-1", "Leads", "lead-1");
    await linkRepo.setDeletionRequested("subject", "sub-1");

    const result = await handler.syncDeal(shopOrder);
    expect(result).toEqual({ outcome: "skipped", reason: "deletion_requested" });
  });
});
