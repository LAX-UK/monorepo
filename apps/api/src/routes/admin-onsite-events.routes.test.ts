import { Hono } from "hono";
import type { Redis } from "ioredis";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IOnsiteEventCheckInService } from "../services/interfaces/onsite-event-check-in-service.js";
import type { IOnsiteEventRsvpService } from "../services/interfaces/onsite-event-rsvp-service.js";
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

  const onsiteEventRsvpService: IOnsiteEventRsvpService = {
    getPublicConfig: vi.fn(),
    lookupByEmail: vi.fn(),
    submitRsvp: vi.fn(),
    listAdminEvents: vi.fn(),
    listAdminRsvps: vi.fn(),
    exportAdminCsv: vi.fn(),
    resendPass,
    setCheckInDryRun: vi.fn(),
  };

  const onsiteEventCheckInService: IOnsiteEventCheckInService = {
    getPassView: vi.fn(),
    renderPassQrSvg: vi.fn(),
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
      onsiteEventRsvpService,
      onsiteEventCheckInService,
      redis: buildRateLimitRedis(),
    } as unknown as Container;
    hono.route("/admin/onsite-events", createAdminOnsiteEventRoutes(container));
    return hono;
  }

  it("POST resend-pass requires staff auth", async () => {
    const res = await app().request(
      "/admin/onsite-events/lax001/rsvps/550e8400-e29b-41d4-a716-446655440000/resend-pass",
      { method: "POST" },
    );
    expect(res.status).toBe(401);
  });

  it("POST resend-pass audits and returns emailSent", async () => {
    const rsvpId = "550e8400-e29b-41d4-a716-446655440000";
    const res = await app("staff-1").request(
      `/admin/onsite-events/lax001/rsvps/${rsvpId}/resend-pass`,
      { method: "POST" },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { rotated: boolean; emailSent: boolean } };
    expect(body.data.emailSent).toBe(true);
    expect(recordPassResend).toHaveBeenCalledWith("lax001", rsvpId, "staff-1");
  });
});
