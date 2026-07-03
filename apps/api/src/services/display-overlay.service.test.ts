import { describe, expect, it, vi } from "vitest";
import { DisplayOverlayService } from "./display-overlay.service.js";

describe("DisplayOverlayService", () => {
  it("publishes overlay and records domain event on setOverlay", async () => {
    const saleroomDisplaySessionRepo = {
      setDisplayOverlay: vi.fn().mockResolvedValue({ updated: true }),
      clearDisplayOverlay: vi.fn(),
    };

    const publisher = { publishDisplayControl: vi.fn().mockResolvedValue(undefined) };
    const domainEventSink = { publish: vi.fn().mockResolvedValue(undefined), withTx: vi.fn() };

    const service = new DisplayOverlayService({
      saleroomDisplaySessionRepo,
      publisher: publisher as never,
      domainEventSink: domainEventSink as never,
    });

    const result = await service.setOverlay({
      saleId: "sale-1",
      kind: "fair_warning",
      actorUserId: "staff-1",
    });

    expect(result.isOk()).toBe(true);
    expect(saleroomDisplaySessionRepo.setDisplayOverlay).toHaveBeenCalledWith({
      saleId: "sale-1",
      overlay: expect.objectContaining({ kind: "fair_warning" }),
    });
    expect(publisher.publishDisplayControl).toHaveBeenCalledWith(
      "sale-1",
      expect.objectContaining({ kind: "fair_warning" }),
    );
    expect(domainEventSink.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "saleroom.display.overlay_set",
        actorUserId: "staff-1",
      }),
    );
  });

  it("publishes clear and records domain event on clearOverlay", async () => {
    const saleroomDisplaySessionRepo = {
      setDisplayOverlay: vi.fn(),
      clearDisplayOverlay: vi.fn().mockResolvedValue({ updated: true }),
    };

    const publisher = { publishDisplayControl: vi.fn().mockResolvedValue(undefined) };
    const domainEventSink = { publish: vi.fn().mockResolvedValue(undefined), withTx: vi.fn() };

    const service = new DisplayOverlayService({
      saleroomDisplaySessionRepo,
      publisher: publisher as never,
      domainEventSink: domainEventSink as never,
    });

    const result = await service.clearOverlay({
      saleId: "sale-1",
      actorUserId: "staff-1",
    });

    expect(result.isOk()).toBe(true);
    expect(saleroomDisplaySessionRepo.clearDisplayOverlay).toHaveBeenCalledWith("sale-1");
    expect(publisher.publishDisplayControl).toHaveBeenCalledWith(
      "sale-1",
      expect.objectContaining({ kind: "clear" }),
    );
    expect(domainEventSink.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "saleroom.display.overlay_clear",
        actorUserId: "staff-1",
      }),
    );
  });
});
