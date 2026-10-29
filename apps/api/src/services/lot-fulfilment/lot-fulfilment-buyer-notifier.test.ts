import type { ILotFulfilmentRepository } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { LotFulfilmentService } from "../lot-fulfilment.service.js";
import { NotificationFactory } from "../notification.factory.js";
import { LotFulfilmentBuyerNotifier, collectionPlaceOf } from "./lot-fulfilment-buyer-notifier.js";

const lotId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const buyerId = "buyer-1";
const lot = { id: lotId, title: "Blue Vase", winnerId: buyerId, saleId: "sale-1" };

type Status = "released" | "ready_for_collection" | "in_transit" | "delivered";

/** A fulfilment repository that keeps one row, so a repeated call sees the new status. */
function setup(opts: { status: Status; dispatchFails?: boolean; sale?: object | null }) {
  let row = { lotId, status: opts.status } as Record<string, unknown>;
  const fulfilmentRepo = {
    findByLotId: vi.fn(async () => row),
    updateByLotId: vi.fn(async (_id: string, patch: Record<string, unknown>) => {
      row = { ...row, ...patch };
    }),
  } as unknown as ILotFulfilmentRepository;
  const dispatch = vi.fn(async (_userId: string, _payload: unknown) => {
    if (opts.dispatchFails) throw new Error("channel down");
  });
  const sale =
    opts.sale === undefined
      ? {
          locationName: "Mayfair Rooms",
          locationAddress: null,
          locationAddressLine1: "1 High Street",
          locationAddressLine2: null,
          locationCity: "London",
          locationPostcode: "W1 1AA",
        }
      : opts.sale;
  const lots = { findById: vi.fn(async () => lot) };
  const notifier = new LotFulfilmentBuyerNotifier(
    lots as never,
    { findById: vi.fn(async () => sale) } as never,
    { dispatch },
    new NotificationFactory(),
  );
  const service = new LotFulfilmentService(lots as never, fulfilmentRepo, notifier);
  return { service, dispatch };
}

describe("fulfilment notices to the buyer", () => {
  it("tells the buyer once when the lot is ready to collect, and not again on a retry", async () => {
    const { service, dispatch } = setup({ status: "released" });
    const first = await service.markReadyForCollection({ lotId, actorUserId: "staff" });
    expect(first.isOk()).toBe(true);
    const retry = await service.markReadyForCollection({ lotId, actorUserId: "staff" });
    expect(retry.isErr()).toBe(true);

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(
      buyerId,
      expect.objectContaining({
        type: "lot_ready_for_collection",
        lotId,
        message: expect.stringContaining("Mayfair Rooms, 1 High Street, London, W1 1AA"),
        meta: expect.objectContaining({
          outboxIdempotencyKey: `lot-fulfilment:${lotId}:lot_ready_for_collection`,
          emailIdempotencyKey: `lot-fulfilment:${lotId}:lot_ready_for_collection`,
        }),
      }),
    );
  });

  it("tells the buyer once when the lot ships, with carrier and tracking", async () => {
    const { service, dispatch } = setup({ status: "released" });
    const input = { lotId, actorUserId: "staff", carrier: "DHL", trackingNumber: "JD01" };
    expect((await service.markShipped(input)).isOk()).toBe(true);
    expect((await service.markShipped(input)).isErr()).toBe(true);

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(
      buyerId,
      expect.objectContaining({
        type: "lot_shipped",
        message: expect.stringContaining("DHL"),
        meta: expect.objectContaining({ carrier: "DHL", trackingNumber: "JD01" }),
      }),
    );
  });

  it("tells the buyer once when the lot is delivered", async () => {
    const { service, dispatch } = setup({ status: "in_transit" });
    expect((await service.markDelivered({ lotId, actorUserId: "staff" })).isOk()).toBe(true);
    expect((await service.markDelivered({ lotId, actorUserId: "staff" })).isErr()).toBe(true);

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0]?.[1]).toMatchObject({
      type: "lot_delivered",
      title: "Your lot has been delivered",
    });
  });

  it("tells the buyer once when the lot is collected", async () => {
    const { service, dispatch } = setup({ status: "ready_for_collection" });
    const input = { lotId, actorUserId: "staff", collectedBy: "Ada" };
    expect((await service.markCollected(input)).isOk()).toBe(true);
    expect((await service.markCollected(input)).isErr()).toBe(true);

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0]?.[1]).toMatchObject({
      type: "lot_delivered",
      title: "Your lot has been collected",
    });
  });

  it("does not notify for a transition that is refused", async () => {
    const { service, dispatch } = setup({ status: "in_transit" });
    const result = await service.markReadyForCollection({ lotId, actorUserId: "staff" });
    expect(result.isErr()).toBe(true);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("does not fail the transition when the notice cannot be sent", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { service, dispatch } = setup({ status: "released", dispatchFails: true });
    const result = await service.markShipped({
      lotId,
      actorUserId: "staff",
      carrier: "DHL",
      trackingNumber: "JD01",
    });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(result.isOk()).toBe(true);
    consoleError.mockRestore();
  });

  it("falls back to the purchase when the sale has no venue", async () => {
    const { service, dispatch } = setup({ status: "released", sale: null });
    await service.markReadyForCollection({ lotId, actorUserId: "staff" });
    expect(dispatch.mock.calls[0]?.[1]).toMatchObject({
      message: expect.stringContaining("Open your purchase"),
    });
  });
});

describe("collectionPlaceOf", () => {
  const blank = {
    locationName: null,
    locationAddress: null,
    locationAddressLine1: null,
    locationAddressLine2: null,
    locationCity: null,
    locationPostcode: null,
  };

  it("joins the venue name and structured address", () => {
    expect(
      collectionPlaceOf({
        ...blank,
        locationName: "Mayfair Rooms",
        locationAddressLine1: "1 High Street",
        locationCity: "London",
        locationPostcode: "W1 1AA",
      }),
    ).toBe("Mayfair Rooms, 1 High Street, London, W1 1AA");
  });

  it("uses the single-line address of older sales", () => {
    expect(collectionPlaceOf({ ...blank, locationAddress: "1 High Street\nLondon" })).toBe(
      "1 High Street, London",
    );
  });

  it("is empty without a sale or venue details", () => {
    expect(collectionPlaceOf(null)).toBeNull();
    expect(collectionPlaceOf(blank)).toBeNull();
  });
});
