import type { IAccountRecordSearchReader, LotSearchHit } from "@auction/persistence/interfaces";
import type { LegalEntityMemberRole } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { AccountRecordSearchService } from "./account-record-search.service.js";

const ENTITY = "00000000-0000-4000-8000-000000000001";
const NOW = new Date("2026-11-10T12:00:00Z");

function lotHit(n: number): LotSearchHit {
  return {
    lotId: `lot-${n}`,
    title: `Work ${n}`,
    artistName: "David Hockney",
    lotNumber: n,
    saleId: "sale-1",
    saleTitle: "Modern British",
    lotStatus: "ended",
    endsAt: new Date("2026-10-01T12:00:00Z"),
  };
}

function setup(rows = 0) {
  const read = vi.fn(async (_criteria: { scope: string }) =>
    Array.from({ length: rows }, (_, i) => lotHit(i + 1)),
  );
  const reader = {
    consignments: read,
    purchases: read,
    bids: read,
    works: read,
    invoices: read,
    members: read,
  } as unknown as IAccountRecordSearchReader;
  return { service: new AccountRecordSearchService(reader, () => NOW), read };
}

const actor = (role: LegalEntityMemberRole) => ({ userId: "me", legalEntityId: ENTITY, role });

describe("AccountRecordSearchService", () => {
  it("searches every group the role may open, each with the list's own scope", async () => {
    const { service, read } = setup();
    const result = await service.search(actor("buyer_agent"), { q: "hockney", offset: 0 });
    expect(result._unsafeUnwrap()).toEqual({
      searchable: ["purchases", "bids", "works"],
      groups: [
        { group: "purchases", items: [], nextOffset: null },
        { group: "bids", items: [], nextOffset: null },
        { group: "works", items: [], nextOffset: null },
      ],
    });
    expect(read.mock.calls.map(([criteria]) => criteria.scope)).toEqual(["own", "own", "all"]);
    expect(read).toHaveBeenCalledWith({
      legalEntityId: ENTITY,
      userId: "me",
      scope: "own",
      terms: { text: "hockney", lotNumber: null, consignmentNumber: null },
      limit: 6,
      offset: 0,
      now: NOW,
    });
  });

  it("returns the first five of each group and says where the next page starts", async () => {
    const { service } = setup(6);
    const groups = (
      await service.search(actor("finance"), { q: "work", offset: 0 })
    )._unsafeUnwrap().groups;
    expect(groups.map((g) => g.group)).toEqual(["consignments", "purchases", "invoices"]);
    expect(groups[0]?.items).toHaveLength(5);
    expect(groups[0]?.nextOffset).toBe(5);
  });

  it("pages through one group on its own", async () => {
    const { service, read } = setup(3);
    const result = await service.search(actor("owner"), {
      q: "work",
      group: "bids",
      limit: 20,
      offset: 40,
    });
    expect(read).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledWith(expect.objectContaining({ limit: 21, offset: 40 }));
    expect(result._unsafeUnwrap().groups).toEqual([
      { group: "bids", items: [lotHit(1), lotHit(2), lotHit(3)], nextOffset: null },
    ]);
  });

  it("refuses a group the role cannot open, without reading anything", async () => {
    const { service, read } = setup();
    const result = await service.search(actor("consignor"), {
      q: "work",
      group: "invoices",
      offset: 0,
    });
    expect(result._unsafeUnwrapErr()).toMatchObject({
      code: "insufficient_entity_role",
      status: 403,
    });
    expect(read).not.toHaveBeenCalled();
  });

  it("reads nothing for text too short to search, but still lists the searchable groups", async () => {
    const { service, read } = setup();
    const result = await service.search(actor("consignor"), { q: " a ", offset: 0 });
    expect(result._unsafeUnwrap()).toEqual({ searchable: ["consignments"], groups: [] });
    expect(read).not.toHaveBeenCalled();
  });

  it("lets an impersonating admin search, read-only", async () => {
    const { service } = setup();
    const result = await service.search(
      { ...actor("admin"), isImpersonation: true },
      { q: "work", offset: 0 },
    );
    expect(result._unsafeUnwrap().searchable).toEqual([
      "consignments",
      "purchases",
      "bids",
      "invoices",
      "members",
    ]);
  });
});
