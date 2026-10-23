import type { AtgSaleOwnershipSnapshot, Lot } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { withAtgLotStates } from "./sale-selling-platform.js";

function ownership(
  atgRemoteStatus: string,
  sellingPlatform: AtgSaleOwnershipSnapshot["sellingPlatform"],
): AtgSaleOwnershipSnapshot {
  return {
    saleStatus: "draft",
    atgRemoteStatus,
    atgLinked: true,
    atgSoldLotCount: 1,
    sellingPlatform,
  } as AtgSaleOwnershipSnapshot;
}

const lot = (id: string, saleId: string | null, status: Lot["status"] = "draft") =>
  ({ id, saleId, status }) as Lot;

describe("withAtgLotStates", () => {
  it("tags draft lots of live and ended ATG sales, with sold flags for ended sales", async () => {
    const reader = {
      getSaleOwnerships: vi.fn().mockResolvedValue(
        new Map([
          ["live", ownership("published", "atg")],
          ["ended", ownership("closed", "atg")],
          ["free", ownership("draft", "free")],
        ]),
      ),
      getSoldLotIds: vi.fn().mockResolvedValue(new Set(["l2"])),
    };

    const rows = await withAtgLotStates(reader, [
      lot("l1", "live"),
      lot("l2", "ended"),
      lot("l3", "ended"),
      lot("l4", "free"),
      lot("l5", "live", "active"),
    ]);

    expect(reader.getSaleOwnerships).toHaveBeenCalledWith(["live", "ended", "free"]);
    expect(reader.getSoldLotIds).toHaveBeenCalledTimes(1);
    expect(reader.getSoldLotIds).toHaveBeenCalledWith("ended");
    expect(rows.map((r) => [r.id, r.atgSaleState, r.atgSold])).toEqual([
      ["l1", "live", undefined],
      ["l2", "ended", true],
      ["l3", "ended", false],
      ["l4", undefined, undefined],
      ["l5", undefined, undefined],
    ]);
  });

  it("skips the lookup when no draft lot belongs to a sale", async () => {
    const reader = { getSaleOwnerships: vi.fn(), getSoldLotIds: vi.fn() };
    const rows = [lot("l1", "s1", "active"), lot("l2", null)];

    expect(await withAtgLotStates(reader, rows)).toBe(rows);
    expect(await withAtgLotStates(null, rows)).toBe(rows);
    expect(reader.getSaleOwnerships).not.toHaveBeenCalled();
  });
});
