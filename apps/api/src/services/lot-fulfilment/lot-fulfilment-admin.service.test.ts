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
    // One conditional update: it moves the lot only while it is still in a status asked for.
    updateIfStatus: async (
      _id: string,
      from: readonly LotFulfilmentRow["status"][],
      patch: UpdateLotFulfilmentInput,
    ) => {
      if (!from.includes(row.status)) return false;
      row = { ...row, ...patch } as LotFulfilmentRow;
      return true;
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

describe("two actions on the same lot", () => {
  it("lets only the first succeed: the second finds the status already changed", async () => {
    const s = setup("ready_for_collection");
    const first = await s.service.markCollected({
      lotId: LOT,
      actorUserId: "staff-1",
      collectedBy: "Charlotte Hayes",
    });
    const second = await s.service.markCollected({
      lotId: LOT,
      actorUserId: "staff-2",
      collectedBy: "Someone else",
    });
    expect(first.isOk()).toBe(true);
    expect(second._unsafeUnwrapErr()).toMatchObject({ code: "invalid_status", status: 400 });
    expect(s.row().collectedBy).toBe("Charlotte Hayes");
    expect(s.notify).toHaveBeenCalledTimes(1);
  });

  it("reports a lot with no fulfilment as missing", async () => {
    const s = setup("ready_for_collection");
    const service = new LotFulfilmentAdminService({
      fulfilmentRepo: {
        findByLotId: async () => null,
        updateIfStatus: async () => false,
      } as unknown as ILotFulfilmentRepository,
      lotRepo: {} as ILotRepository,
      buyerNotifier: { notify: s.notify },
    });
    expect(
      (
        await service.markCollected({ lotId: LOT, actorUserId: "staff-1", collectedBy: "X" })
      )._unsafeUnwrapErr(),
    ).toMatchObject({ code: "no_fulfilment", status: 404 });
  });
});
