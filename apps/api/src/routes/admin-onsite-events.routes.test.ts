import { Hono } from "hono";
import type { Redis } from "ioredis";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IOnsiteEventAdminService } from "../services/interfaces/onsite-event-admin-service.js";
import type { IOnsiteEventStaffCheckInService } from "../services/interfaces/onsite-event-staff-check-in-service.js";
import { createAdminOnsiteEventRoutes } from "./admin-onsite-events.js";

function buildRateLimitRedis(): Redis {
  let count = 0;
  return {
    multi: () => ({
      zadd: vi.fn().mockReturnThis(),
      zremrangebyscore: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      zcard: vi.fn().mockReturnThis(),
      exec: vi.fn().mockImplementation(async () => {
        count += 1;
        return [
          [null, 1],
          [null, 0],
          [null, 1],
          [null, count],
        ];
      }),
    }),
  } as unknown as Redis;
}

describe("admin onsite event routes", () => {
  const recordPassResend = vi.fn().mockResolvedValue(undefined);
  const resendPass = vi.fn().mockResolvedValue({ ok: true, rotated: false, emailSent: true });

  const onsiteEventAdminService: IOnsiteEventAdminService = {
    listAdminEvents: vi.fn(),
    getAdminEventDetail: vi.fn(),
    listAdminRsvps: vi.fn(),
    exportAdminCsv: vi.fn(),
    resendPass,
    setCheckInDryRun: vi.fn(),
    createAdminEvent: vi.fn(),
    updateAdminEvent: vi.fn(),
  };

  const onsiteEventStaffCheckInService: IOnsiteEventStaffCheckInService = {
    checkIn: vi.fn(),
    searchGuests: vi.fn(),
    getCheckInStats: vi.fn(),
    recordPassResend,
  };

  function app(userId?: string) {
    const hono = new Hono<{ Variables: { userId?: string } }>();
    hono.use("*", async (c, next) => {
      if (userId) c.set("userId", userId);
      await next();
    });
    const container = {
      admin: {
        onsiteEvents: {
          ...onsiteEventAdminService,
          ...onsiteEventStaffCheckInService,
        },
      },
      redis: buildRateLimitRedis(),
    } as unknown as Container;
    hono.route("/admin/event-rsvps", createAdminOnsiteEventRoutes(container));
    return hono;
  }

  it("GET detail returns admin event metadata", async () => {
    vi.mocked(onsiteEventAdminService.getAdminEventDetail).mockResolvedValue({
      slug: "lax001",
      title: "LAX 001",
      status: "published",
      startsAt: "2026-06-18T18:00:00.000Z",
      rsvpCloseAt: null,
      segmentOptions: [{ value: "full_evening", label: "Full evening" }],
      micrositeUrl: "https://event.lax.bid",
      venue: null,
      dressCode: null,
      arrivalNote: null,
      opsEmail: "events@lax.bid",
      checkInDryRun: false,
      rsvpCount: 3,
      checkedInCount: 1,
      saleId: null,
    });

    const res = await app("staff-1").request("/admin/event-rsvps/lax001");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { slug: string; rsvpCount: number } };
    expect(body.data.slug).toBe("lax001");
    expect(body.data.rsvpCount).toBe(3);
  });

  it("POST resend-pass requires staff auth", async () => {
    const res = await app().request(
      "/admin/event-rsvps/lax001/rsvps/550e8400-e29b-41d4-a716-446655440000/resend-pass",
      { method: "POST" },
    );
    expect(res.status).toBe(401);
  });

  it("POST resend-pass audits and returns emailSent", async () => {
    const rsvpId = "550e8400-e29b-41d4-a716-446655440000";
    const res = await app("staff-1").request(
      `/admin/event-rsvps/lax001/rsvps/${rsvpId}/resend-pass`,
      { method: "POST" },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { rotated: boolean; emailSent: boolean } };
    expect(body.data.emailSent).toBe(true);
    expect(recordPassResend).toHaveBeenCalledWith("lax001", rsvpId, "staff-1");
  });
});
