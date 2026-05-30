import { describe, expect, it } from "vitest";
import { parseLotEventPayload } from "./lot-events.js";

describe("parseLotEventPayload", () => {
  it("parses lot.soft_deleted payload", () => {
    const payload = parseLotEventPayload("lot.soft_deleted", {
      title: "Evening lot",
      from_status: "draft",
      saleId: "550e8400-e29b-41d4-a716-446655440000",
      deleted_at: "2026-05-30T12:00:00.000Z",
    });
    expect(payload).toMatchObject({
      title: "Evening lot",
      from_status: "draft",
      saleId: "550e8400-e29b-41d4-a716-446655440000",
      deleted_at: "2026-05-30T12:00:00.000Z",
    });
  });

  it("accepts null saleId on lot.soft_deleted", () => {
    const payload = parseLotEventPayload("lot.soft_deleted", {
      title: "Standalone lot",
      from_status: "scheduled",
      saleId: null,
      deleted_at: "2026-05-30T12:00:00.000Z",
    });
    expect(payload.saleId).toBeNull();
  });
});
