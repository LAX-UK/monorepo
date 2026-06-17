import { describe, expect, it, vi } from "vitest";
import { DisplayOverlayService } from "./display-overlay.service.js";

describe("DisplayOverlayService", () => {
  it("publishes overlay and records domain event on setOverlay", async () => {
    const returning = vi.fn().mockResolvedValue([{ id: "session-1" }]);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });
    const update = vi.fn().mockReturnValue({ set });

    const publisher = { publishDisplayControl: vi.fn().mockResolvedValue(undefined) };
    const domainEvents = { publish: vi.fn().mockResolvedValue(undefined) };

    const service = new DisplayOverlayService({
      db: { update } as never,
      publisher: publisher as never,
      domainEvents: domainEvents as never,
    });

    const result = await service.setOverlay({
      saleId: "sale-1",
      kind: "fair_warning",
      actorUserId: "staff-1",
    });

    expect(result.isOk()).toBe(true);
    expect(publisher.publishDisplayControl).toHaveBeenCalledWith(
      "sale-1",
      expect.objectContaining({ kind: "fair_warning" }),
    );
    expect(domainEvents.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: "saleroom.display.overlay_set",
        actorUserId: "staff-1",
      }),
    );
  });

  it("publishes clear and records domain event on clearOverlay", async () => {
    const returning = vi.fn().mockResolvedValue([{ id: "session-1" }]);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });
    const update = vi.fn().mockReturnValue({ set });

    const publisher = { publishDisplayControl: vi.fn().mockResolvedValue(undefined) };
    const domainEvents = { publish: vi.fn().mockResolvedValue(undefined) };

    const service = new DisplayOverlayService({
      db: { update } as never,
      publisher: publisher as never,
      domainEvents: domainEvents as never,
    });

    const result = await service.clearOverlay({
      saleId: "sale-1",
      actorUserId: "staff-1",
    });

    expect(result.isOk()).toBe(true);
    expect(publisher.publishDisplayControl).toHaveBeenCalledWith(
      "sale-1",
      expect.objectContaining({ kind: "clear" }),
    );
    expect(domainEvents.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: "saleroom.display.overlay_clear",
        actorUserId: "staff-1",
      }),
    );
  });
});
