import { afterEach, describe, expect, it, vi } from "vitest";
import type { CrmMappedIntent } from "../crm-event-mappers.js";
import { InMemoryCrmLinkRepo, fakeCrmGateway } from "../crm-test-doubles.js";
import { CrmDealSyncHandler } from "./crm-deal-sync-handler.js";
import { CrmLeadConversionHandler, HELD_DEAL_RECHECK_MS } from "./crm-lead-conversion-handler.js";
import { CrmPaidBuyerHandler } from "./crm-paid-buyer-handler.js";
import { CrmPersonSyncHandler } from "./crm-person-sync-handler.js";

const shopOrder: Extract<CrmMappedIntent, { kind: "deal_upsert" }> = {
  kind: "deal_upsert",
  subjectId: "sub-1",
  dealEntityId: "shop-order:o1",
  dealKey: "shop-order:o1",
  purchase: { product: "LAX Shop", paid: true },
  fields: { Deal_Name: "Shop order o1", Amount: 480, Stage: "Paid" },
};

async function setup(findLead: ReturnType<typeof vi.fn>) {
  const gateway = fakeCrmGateway({ findLead });
  const linkRepo = new InMemoryCrmLinkRepo();
  const dealHandler = new CrmDealSyncHandler({
    gateway,
    linkRepo,
    personHandler: new CrmPersonSyncHandler({ gateway, linkRepo }),
    paidBuyerHandler: new CrmPaidBuyerHandler({ gateway, linkRepo }),
  });
  vi.useFakeTimers({ toFake: ["Date"] });
  let clock = new Date("2026-11-04T10:00:00Z");
  vi.setSystemTime(clock);
  const handler = new CrmLeadConversionHandler({ gateway, linkRepo, dealHandler });
  await linkRepo.seedSubject("sub-1", "Leads", "lead-1");
  await dealHandler.syncDeal(shopOrder);
  return {
    gateway,
    linkRepo,
    handler,
    advance: (ms: number) => {
      clock = new Date(clock.getTime() + ms);
      vi.setSystemTime(clock);
    },
  };
}

describe("CrmLeadConversionHandler", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps deals held while an admin has not converted the lead", async () => {
    const { gateway, linkRepo, handler } = await setup(
      vi.fn(async () => ({ status: "Qualified", ownerId: null, convertedContactId: null })),
    );

    expect(await handler.releaseIfConverted("sub-1")).toBe(0);

    expect(gateway.upsert).not.toHaveBeenCalled();
    expect((await linkRepo.findByEntity("deal", "shop-order:o1"))?.zohoModule).toBe("__held__");
    expect((await linkRepo.findByEntity("subject", "sub-1"))?.zohoModule).toBe("Leads");
  });

  it("links the new Contact and puts the waiting deals on it once converted", async () => {
    const { gateway, linkRepo, handler } = await setup(
      vi.fn(async () => ({
        status: "Converted to Client",
        ownerId: null,
        convertedContactId: "contact-9",
      })),
    );

    expect(await handler.releaseIfConverted("sub-1")).toBe(1);

    expect(await linkRepo.findByEntity("subject", "sub-1")).toMatchObject({
      zohoModule: "Contacts",
      zohoRecordId: "contact-9",
    });
    expect(gateway.updateById).toHaveBeenCalledWith({
      module: "Contacts",
      recordId: "contact-9",
      fields: { LAX_Subject_ID: "sub-1" },
    });
    const dealFields = gateway.upsert.mock.calls[0]?.[0]?.fields as Record<string, unknown>;
    expect(dealFields).toMatchObject({
      Deal_Name: "Shop order o1",
      Contact_Name: { id: "contact-9" },
    });
    const row = await linkRepo.findByEntity("deal", "shop-order:o1");
    expect(row?.zohoModule).toBe("Deals");
    expect(row?.heldPayload).toBeNull();
  });

  it("sweeps only held deals not checked recently, and moves on after each check", async () => {
    const findLead = vi.fn(async () => ({
      status: "Qualified",
      ownerId: null,
      convertedContactId: null,
    }));
    const { handler, advance } = await setup(findLead);
    findLead.mockClear();

    advance(HELD_DEAL_RECHECK_MS - 1_000);
    expect(await handler.releaseConvertedLeads()).toEqual({ checked: 0, released: 0, failed: 0 });
    expect(findLead).not.toHaveBeenCalled();

    advance(2_000);
    expect(await handler.releaseConvertedLeads()).toEqual({ checked: 1, released: 0, failed: 0 });
    expect(findLead).toHaveBeenCalledTimes(1);
    // Checked just now: the next tick leaves it alone.
    expect(await handler.releaseConvertedLeads()).toEqual({ checked: 0, released: 0, failed: 0 });
  });

  it("releases from the sweep when the lead was converted", async () => {
    const convertedLead = {
      status: "Converted to Client",
      ownerId: null,
      convertedContactId: "contact-9",
    };
    const findLead = vi.fn(async () => convertedLead);
    const { handler, advance, gateway } = await setup(findLead);
    advance(HELD_DEAL_RECHECK_MS + 1_000);

    expect(await handler.releaseConvertedLeads()).toEqual({ checked: 1, released: 1, failed: 0 });
    expect(gateway.upsert).toHaveBeenCalledTimes(1);
  });

  it("counts a failing subject and keeps sweeping", async () => {
    const findLead = vi
      .fn()
      .mockResolvedValueOnce({ status: null, ownerId: null, convertedContactId: null })
      .mockRejectedValue(new Error("zoho down"));
    const { handler, advance } = await setup(findLead);
    advance(HELD_DEAL_RECHECK_MS + 1_000);

    expect(await handler.releaseConvertedLeads()).toEqual({ checked: 1, released: 0, failed: 1 });
  });
});
