import { Hono } from "hono";
import type { Redis } from "ioredis";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IOnsiteEventPassService } from "../services/interfaces/onsite-event-pass-service.js";
import type { IOnsiteEventPublicRsvpService } from "../services/interfaces/onsite-event-public-rsvp-service.js";
import { createOnsiteEventRoutes } from "./onsite-events.js";

function buildRateLimitRedis(): Redis {
  let count = 0;
  return {
    multi: () => {
      const chain = {
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
      };
      return chain;
    },
  } as unknown as Redis;
}

describe("onsite event routes", () => {
  const onsiteEventPublicRsvpService: IOnsiteEventPublicRsvpService = {
    getPublicConfig: vi.fn().mockResolvedValue({
      slug: "lax001",
      title: "LAX 001",
      segmentOptions: [{ value: "full_evening", label: "Full evening" }],
      rsvpOpen: true,
      rsvpCloseAt: "2026-06-18T16:00:00.000Z",
      micrositeUrl: "https://event.lax.bid",
      startsAt: null,
      venue: null,
      dressCode: null,
      arrivalNote: null,
      opsEmail: "events@lax.bid",
      saleId: null,
      linkedSaleTitle: null,
      status: "published",
    }),
    listUpcomingPublicEvents: vi.fn().mockResolvedValue([
      {
        slug: "lax002",
        title: "Summer evening",
        startsAt: "2026-08-14T17:00:00.000Z",
        venue: "Royal Academy, London",
        dressCode: "Smart formal",
        micrositeUrl: "https://event.lax.bid/lax002",
        deliveryMode: "hybrid",
      },
    ]),
    lookupByEmail: vi.fn().mockResolvedValue({
      status: "ready",
      user: { name: "Guest", email: "guest@example.com" },
      segmentOptions: [{ value: "full_evening", label: "Full evening" }],
    }),
    submitRsvp: vi.fn().mockResolvedValue({
      ok: true,
      isUpdate: false,
      passUrl: "https://event.lax.bid/pass/test-token",
      data: {
        id: "rsvp-1",
        eventSlug: "lax001",
        attendanceSegment: "full_evening",
        plusOne: 0,
        plusOneGuestName: null,
        notes: null,
        createdAt: new Date("2026-06-01T12:00:00.000Z"),
        updatedAt: new Date("2026-06-01T12:00:00.000Z"),
      },
    }),
  };

  const onsiteEventPassService: IOnsiteEventPassService = {
    getPassView: vi.fn(),
    getPassViewByToken: vi.fn(),
    renderPassQrSvg: vi.fn(),
  };

  function app() {
    const hono = new Hono();
    const container = {
      onsiteEventPublicRsvpService,
      onsiteEventPassService,
      redis: buildRateLimitRedis(),
      env: { API_PUBLIC_URL: "https://api.lax.bid" },
    } as unknown as Container;
    hono.route("/events", createOnsiteEventRoutes(container));
    return hono;
  }

  it("GET /events returns upcoming public events", async () => {
    const res = await app().request("/events");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, max-age=60");
    const body = (await res.json()) as { data: Array<{ slug: string }> };
    expect(body.data[0]?.slug).toBe("lax002");
  });

  it("GET /events/:slug/config returns public config", async () => {
    const res = await app().request("/events/lax001/config");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { slug: string } };
    expect(body.data.slug).toBe("lax001");
  });

  it("POST /events/:slug/lookup returns lookup result", async () => {
    const res = await app().request("/events/lax001/lookup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "guest@example.com" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { status: string } };
    expect(body.data.status).toBe("ready");
  });

  it("POST /events/:slug/rsvp accepts email without session", async () => {
    const res = await app().request("/events/lax001/rsvp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "guest@example.com",
        attendanceSegment: "full_evening",
        plusOne: 0,
      }),
    });
    expect(res.status).toBe(201);
  });
});
