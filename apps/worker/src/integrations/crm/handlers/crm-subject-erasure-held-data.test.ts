import { describe, expect, it, vi } from "vitest";
import { InMemoryCrmLinkRepo, fakeCrmGateway } from "../crm-test-doubles.js";
import { CrmSubjectLifecycleHandler } from "./crm-subject-lifecycle-handler.js";

async function seed() {
  const gateway = fakeCrmGateway();
  const linkRepo = new InMemoryCrmLinkRepo();
  await linkRepo.seedSubject("sub-1", "Leads", "lead-1");
  await linkRepo.upsertLink({
    entityType: "note",
    entityId: "paid-customer:shop-order:o1",
    zohoModule: "Notes",
    zohoRecordId: "note-1",
    subjectId: "sub-1",
  });
  await linkRepo.upsertLink({
    entityType: "task",
    entityId: "paid-customer:shop-order:o1",
    zohoModule: "Tasks",
    zohoRecordId: "task-1",
    subjectId: "sub-1",
  });
  await linkRepo.upsertLink({
    entityType: "deal",
    entityId: "shop-order:o1",
    zohoModule: "__held__",
    zohoRecordId: "__none__",
    subjectId: "sub-1",
    heldPayload: {
      fields: { Deal_Name: "Shop order o1" },
      purchase: { product: "LAX Shop", paid: true },
    },
  });
  return { gateway, linkRepo, handler: new CrmSubjectLifecycleHandler({ gateway, linkRepo }) };
}

describe("erasing a person with purchase notes, tasks and held deals", () => {
  it("deletes the notes and tasks in Zoho, empties the recycle bin and drops the held deal", async () => {
    const { gateway, linkRepo, handler } = await seed();

    const result = await handler.eraseSubject("sub-1");

    expect(result.outcome).toBe("success");
    expect(gateway.deleteRecord).toHaveBeenCalledWith({ module: "Notes", recordId: "note-1" });
    expect(gateway.deleteRecord).toHaveBeenCalledWith({ module: "Tasks", recordId: "task-1" });
    expect(gateway.purgeFromRecycleBin).toHaveBeenCalledWith("note-1");
    expect(gateway.purgeFromRecycleBin).toHaveBeenCalledWith("task-1");
    // A held deal was never a Zoho record: nothing to delete there, and its fields are gone here.
    expect(gateway.deleteRecord).not.toHaveBeenCalledWith(
      expect.objectContaining({ module: "Deals" }),
    );
    const held = await linkRepo.findByEntity("deal", "shop-order:o1");
    expect(held?.erasedAt).not.toBeNull();
    expect(held?.heldPayload).toBeNull();
    expect(
      (await linkRepo.findByEntity("note", "paid-customer:shop-order:o1"))?.erasedAt,
    ).not.toBeNull();
    expect(
      (await linkRepo.findByEntity("task", "paid-customer:shop-order:o1"))?.erasedAt,
    ).not.toBeNull();
    expect(await linkRepo.listHeldDeals(10)).toHaveLength(0);
  });

  it("retries, keeping the ledger rows, when a note cannot be deleted", async () => {
    const { gateway, linkRepo, handler } = await seed();
    gateway.deleteRecord.mockImplementation(async (input: { module: string }) =>
      input.module === "Notes"
        ? { status: "error", code: "INTERNAL_ERROR" }
        : { status: "deleted" },
    );

    const result = await handler.eraseSubject("sub-1");

    expect(result.outcome).toBe("retry");
    expect(
      (await linkRepo.findByEntity("note", "paid-customer:shop-order:o1"))?.erasedAt,
    ).toBeNull();
    expect(vi.mocked(gateway.deleteRecord)).not.toHaveBeenCalledWith(
      expect.objectContaining({ module: "Leads" }),
    );
  });
});
