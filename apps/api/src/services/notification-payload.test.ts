import { describe, expect, it } from "vitest";
import {
  notificationLotTitle,
  notificationLotWebPath,
  notificationRowToPayload,
} from "./notification-payload.js";

describe("notificationLotWebPath", () => {
  it("returns canonical slugged path when lot title is in meta", () => {
    expect(
      notificationLotWebPath({
        type: "outbid",
        title: "You have been outbid",
        message: "…",
        lotId: "lot-uuid",
        meta: { lotTitle: "Memory Garden" },
      }),
    ).toBe("/lot/memory-garden/lot-uuid");
  });

  it("returns undefined without meta.lotTitle", () => {
    expect(
      notificationLotWebPath({
        type: "outbid",
        title: "You have been outbid",
        message: "…",
        lotId: "lot-uuid",
      }),
    ).toBeUndefined();
  });
});

describe("notificationLotTitle", () => {
  it("prefers meta.lotTitle over notification title", () => {
    expect(
      notificationLotTitle({
        type: "outbid",
        title: "You have been outbid",
        message: "…",
        meta: { lotTitle: "Blue Period Study" },
      }),
    ).toBe("Blue Period Study");
  });
});

describe("notificationRowToPayload", () => {
  it("passes meta through", () => {
    const payload = notificationRowToPayload({
      userId: "u1",
      type: "outbid",
      title: "You have been outbid",
      message: "…",
      lotId: "lot-1",
      meta: { lotTitle: "Study" },
    });
    expect(payload.meta?.lotTitle).toBe("Study");
  });
});
