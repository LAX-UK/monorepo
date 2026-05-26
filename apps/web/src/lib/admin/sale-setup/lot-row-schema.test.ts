import {
  emptySaleSetupLotRow,
  mergeSavedLotRow,
  mergeWizardRowsWithServerLots,
} from "@/lib/admin/sale-setup";
import { describe, expect, it } from "vitest";

describe("mergeSavedLotRow", () => {
  it("preserves existing source and title when attaching inventory", () => {
    const row = {
      ...emptySaleSetupLotRow("row-1"),
      source: "existing" as const,
    };

    const merged = mergeSavedLotRow(row, "lot-abc", { title: "Blue vase" });

    expect(merged.lotId).toBe("lot-abc");
    expect(merged.source).toBe("existing");
    expect(merged.title).toBe("Blue vase");
  });

  it("preserves populated form values when saving a new lot", () => {
    const values = {
      ...emptySaleSetupLotRow("row-1"),
      title: "Blue vase",
      sellerLegalEntityId: "20000000-0000-4000-8000-000000000002",
      categoryIds: ["30000000-0000-4000-8000-000000000003"],
      startingPrice: "250.00",
      startTime: "2030-01-01T10:00",
      endTime: "2030-01-01T11:00",
    };

    const merged = mergeSavedLotRow(values, "lot-new");

    expect(merged.lotId).toBe("lot-new");
    expect(merged.title).toBe("Blue vase");
    expect(merged.sellerLegalEntityId).toBe(values.sellerLegalEntityId);
    expect(merged.categoryIds).toEqual(values.categoryIds);
    expect(merged.startingPrice).toBe("250.00");
    expect(merged.clientRowId).toBe("row-1");
  });
});

describe("mergeWizardRowsWithServerLots", () => {
  it("keeps unsaved rows while syncing saved lots from the server", () => {
    const unsaved = emptySaleSetupLotRow("draft-row");
    const current = [
      mergeSavedLotRow({ ...emptySaleSetupLotRow("attach-row"), source: "existing" }, "lot-1", {
        title: "Attached vase",
      }),
      unsaved,
    ];
    const merged = mergeWizardRowsWithServerLots(
      current,
      [
        {
          id: "lot-1",
          title: "Attached vase",
          sellerLegalEntityId: "seller-1",
          categoryIds: ["cat-1"],
          auctionType: "english" as const,
          startingPrice: "10.00",
          artistId: null,
        },
      ],
      (lot) => ({
        ...emptySaleSetupLotRow(lot.id),
        lotId: lot.id,
        title: lot.title,
        sellerLegalEntityId: lot.sellerLegalEntityId,
        categoryIds: lot.categoryIds,
        auctionType: lot.auctionType,
        startingPrice: lot.startingPrice,
        artistId: lot.artistId,
      }),
    );

    expect(merged).toHaveLength(2);
    expect(merged[0]?.source).toBe("existing");
    expect(merged[1]?.clientRowId).toBe("draft-row");
  });

  it("preserves clientRowId when syncing saved rows from the server", () => {
    const saved = mergeSavedLotRow(
      {
        ...emptySaleSetupLotRow("stable-row-id"),
        title: "Saved vase",
        sellerLegalEntityId: "seller-1",
        categoryIds: ["cat-1"],
        startingPrice: "10.00",
      },
      "lot-1",
    );
    const merged = mergeWizardRowsWithServerLots(
      [saved],
      [
        {
          id: "lot-1",
          title: "Saved vase",
          sellerLegalEntityId: "seller-1",
          categoryIds: ["cat-1"],
          auctionType: "english" as const,
          startingPrice: "10.00",
          artistId: null,
        },
      ],
      (lot) => ({
        ...emptySaleSetupLotRow(lot.id),
        lotId: lot.id,
        title: lot.title,
        sellerLegalEntityId: lot.sellerLegalEntityId,
        categoryIds: lot.categoryIds,
        auctionType: lot.auctionType,
        startingPrice: lot.startingPrice,
        artistId: lot.artistId,
      }),
    );

    expect(merged[0]?.clientRowId).toBe("stable-row-id");
    expect(merged[0]?.lotId).toBe("lot-1");
  });
});
