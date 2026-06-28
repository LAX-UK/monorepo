import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createPressRoutes } from "./press.js";

function mockContainer(overrides: Partial<Container["pressArchiveReadService"]> = {}): Container {
  return {
    pressArchiveReadService: {
      listCoverage: vi.fn(),
      listDayMediaSales: vi.fn(),
      getSitemapFreshness: vi.fn(),
      ...overrides,
    },
  } as unknown as Container;
}

function mockAuthenticator(): IAuthenticator {
  return {
    getSessionUser: vi.fn().mockResolvedValue(null),
  };
}

describe("press public routes contract", () => {
  it("GET /coverage returns stable data and meta keys", async () => {
    const app = new Hono();
    const listCoverage = vi.fn().mockResolvedValue({
      data: [
        {
          sale: {
            id: "sale-1",
            title: "Evening Sale",
            status: "ended",
            deliveryMode: "onsite",
            endTime: new Date("2026-06-01T18:00:00.000Z"),
            updatedAt: new Date("2026-06-02T10:00:00.000Z"),
          },
          item: {
            url: "https://example.com/article",
            headline: "Record results",
            outletName: "Example",
            publishedAt: "2026-06-02",
          },
        },
      ],
      meta: {
        total: 1,
        lastUpdated: new Date("2026-06-02T12:00:00.000Z"),
        availableYears: [2026],
      },
    });
    app.route("/press", createPressRoutes(mockContainer({ listCoverage }), mockAuthenticator()));
    const res = await app.request("http://t/press/coverage");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: Array<{ sale: Record<string, unknown>; item: Record<string, unknown> }>;
      meta: Record<string, unknown>;
    };
    expect(body.meta).toMatchObject({
      total: 1,
      lastUpdated: expect.any(String),
      availableYears: [2026],
    });
    expect(body.data).toHaveLength(1);
    expect(body.data[0]?.sale.id).toBe("sale-1");
    expect(body.data[0]?.item.headline).toBe("Record results");
    expect(listCoverage).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 100, offset: 0 }),
      expect.objectContaining({ role: undefined }),
    );
  });

  it("GET /coverage forwards year and q filters", async () => {
    const app = new Hono();
    const listCoverage = vi.fn().mockResolvedValue({
      data: [],
      meta: { total: 0, lastUpdated: null, availableYears: [] },
    });
    app.route("/press", createPressRoutes(mockContainer({ listCoverage }), mockAuthenticator()));
    const res = await app.request("http://t/press/coverage?year=2024&q=BBC&limit=10&offset=5");
    expect(res.status).toBe(200);
    expect(listCoverage).toHaveBeenCalledWith(
      expect.objectContaining({ year: 2024, q: "BBC", limit: 10, offset: 5 }),
      expect.any(Object),
    );
  });

  it("GET /coverage rejects invalid query params", async () => {
    const app = new Hono();
    app.route("/press", createPressRoutes(mockContainer(), mockAuthenticator()));
    const res = await app.request("http://t/press/coverage?year=abc");
    expect(res.status).toBe(400);
  });

  it("GET /day-media returns serialized rows", async () => {
    const app = new Hono();
    const listDayMediaSales = vi.fn().mockResolvedValue([
      {
        id: "sale-1",
        title: "Evening Sale",
        deliveryMode: "onsite",
        endTime: new Date("2026-06-01T18:00:00.000Z"),
        coverImages: ["img/key"],
        dayImageCount: 3,
      },
    ]);
    app.route(
      "/press",
      createPressRoutes(mockContainer({ listDayMediaSales }), mockAuthenticator()),
    );
    const res = await app.request("http://t/press/day-media?limit=12");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<Record<string, unknown>> };
    expect(body.data).toHaveLength(1);
    expect(body.data[0]?.endTime).toBe("2026-06-01T18:00:00.000Z");
    expect(listDayMediaSales).toHaveBeenCalledWith(12, expect.any(Object));
  });

  it("GET /day-media rejects invalid limit", async () => {
    const app = new Hono();
    app.route("/press", createPressRoutes(mockContainer(), mockAuthenticator()));
    const res = await app.request("http://t/press/day-media?limit=0");
    expect(res.status).toBe(400);
  });

  it("GET /sitemap-freshness returns serialized rows", async () => {
    const app = new Hono();
    const getSitemapFreshness = vi.fn().mockResolvedValue([
      {
        saleId: "sale-1",
        title: "Evening Sale",
        lastModified: new Date("2026-06-03T12:00:00.000Z"),
        previewImageSrc: "img/preview",
      },
    ]);
    app.route(
      "/press",
      createPressRoutes(mockContainer({ getSitemapFreshness }), mockAuthenticator()),
    );
    const res = await app.request("http://t/press/sitemap-freshness");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<Record<string, unknown>> };
    expect(body.data[0]?.lastModified).toBe("2026-06-03T12:00:00.000Z");
  });
});
