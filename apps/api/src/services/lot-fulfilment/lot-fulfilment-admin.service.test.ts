import type {
  ILotFulfilmentRepository,
  ILotRepository,
  LotFulfilmentRow,
  UpdateLotFulfilmentInput,
} from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { LotFulfilmentAdminService } from "./lot-fulfilment-admin.service.js";

const LOT = "lot-1";

function setup(status: LotFulfilmentRow["status"]) {
  let row = {
    id: "f1",
    lotId: LOT,
    status,
    fulfilmentMethod: null,
    collectedBy: null,
    collectedByUserId: null,
    collectedAt: null,
  } as unknown as LotFulfilmentRow;
  const repo = {
    findByLotId: async () => row,
    updateByLotId: async (_id: string, patch: UpdateLotFulfilmentInput) => {
      row = { ...row, ...patch } as LotFulfilmentRow;
    },
  } as unknown as ILotFulfilmentRepository;
  const notify = vi.fn(async () => undefined);
  const service = new LotFulfilmentAdminService({
    fulfilmentRepo: repo,
    lotRepo: {} as ILotRepository,
    buyerNotifier: { notify },
  });
  return { service, notify, row: () => row };
}

describe("handing a work over at the desk", () => {
  it.each(["released", "ready_for_collection"] as const)(
    "hands over a lot that is %s, recording who collected and which staff member handed it over",
    async (status) => {
      const s = setup(status);
      const result = await s.service.handOverForCollection({
        lotId: LOT,
        actorUserId: "staff-1",
        collectedBy: "Charlotte Hayes",
      });
      expect(result.isOk()).toBe(true);
      expect(s.row()).toMatchObject({
        status: "delivered",
        fulfilmentMethod: "collection",
        collectedBy: "Charlotte Hayes",
        collectedByUserId: "staff-1",
      });
      expect(s.row().collectedAt).toBeInstanceOf(Date);
      // The booking's own message tells the buyer, not the fulfilment one.
      expect(s.notify).not.toHaveBeenCalled();
    },
  );

  it.each(["awaiting_payment", "awaiting_release", "in_transit", "delivered"] as const)(
    "refuses a lot that is %s",
    async (status) => {
      const s = setup(status);
      const result = await s.service.handOverForCollection({
        lotId: LOT,
        actorUserId: "staff-1",
        collectedBy: "X",
      });
      expect(result._unsafeUnwrapErr()).toMatchObject({ code: "invalid_status", status: 400 });
      expect(s.row().status).toBe(status);
    },
  );

  it("puts a handed-over lot back to ready for collection and clears who collected it", async () => {
    const s = setup("released");
    await s.service.handOverForCollection({ lotId: LOT, actorUserId: "staff-1", collectedBy: "X" });
    const undone = await s.service.undoCollectionHandOver({ lotId: LOT });
    expect(undone.isOk()).toBe(true);
    expect(s.row()).toMatchObject({
      status: "ready_for_collection",
      collectedBy: null,
      collectedByUserId: null,
      collectedAt: null,
    });
  });

  it("cannot undo a lot that was never handed over", async () => {
    const s = setup("released");
    expect((await s.service.undoCollectionHandOver({ lotId: LOT })).isErr()).toBe(true);
  });
});

describe("the existing Mark collected", () => {
  it("still needs ready for collection, and now records the staff member", async () => {
    const early = setup("released");
    expect(
      (
        await early.service.markCollected({ lotId: LOT, actorUserId: "staff-1", collectedBy: "X" })
      ).isErr(),
    ).toBe(true);

    const ready = setup("ready_for_collection");
    const result = await ready.service.markCollected({
      lotId: LOT,
      actorUserId: "staff-1",
      collectedBy: "Ada",
    });
    expect(result.isOk()).toBe(true);
    expect(ready.row()).toMatchObject({ collectedBy: "Ada", collectedByUserId: "staff-1" });
    expect(ready.notify).toHaveBeenCalledOnce();
  });
});
