import { mapServiceToAction, mapServiceToActionVoid } from "@/lib/actions/map-service-result";
import { describe, expect, it } from "vitest";

describe("mapServiceToAction", () => {
  it("maps service failure to ActionResult", () => {
    const r = mapServiceToAction({ ok: false, message: "nope", status: 400, body: {} } as const);
    expect(r).toEqual(expect.objectContaining({ ok: false, error: "nope", status: 400 } as const));
  });

  it("maps void success", () => {
    const r = mapServiceToActionVoid({ ok: true, data: { x: 1 } as object, status: 200 });
    expect(r).toEqual({ ok: true } as const);
  });

  it("passes data on success for mapServiceToAction", () => {
    const r = mapServiceToAction(
      { ok: true, data: { id: "a" } as object, status: 201 },
      { id: "b" },
    );
    expect(r).toEqual({ ok: true, data: { id: "b" } } as const);
  });
});
