import { normalizeUserStaffRole } from "@auction/types";
import { pressArchiveQuerySchema, pressDayMediaQuerySchema } from "@auction/validators";
import { Hono } from "hono";
import type { Container } from "../container.js";
import { zValidator } from "../lib/z-validator.js";
import { createOptionalAuth } from "../middleware/optional-auth.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

function serializePressArchiveListResult(
  result: Awaited<ReturnType<Container["pressArchiveReadService"]["listCoverage"]>>,
) {
  return {
    data: result.data.map((entry) => ({
      sale: {
        ...entry.sale,
        endTime: entry.sale.endTime?.toISOString() ?? null,
        updatedAt: entry.sale.updatedAt.toISOString(),
      },
      item: entry.item,
    })),
    meta: {
      total: result.meta.total,
      lastUpdated: result.meta.lastUpdated?.toISOString() ?? null,
      availableYears: result.meta.availableYears,
    },
  };
}

export function createPressRoutes(container: Container, authenticator: IAuthenticator) {
  const optionalAuth = createOptionalAuth(authenticator);
  const r = new Hono<{
    Variables: { userId?: string; userRole?: string; userStaffRole?: string | null };
  }>();

  r.get("/coverage", optionalAuth, zValidator("query", pressArchiveQuerySchema), async (c) => {
    const query = c.req.valid("query");
    const viewer = {
      role: c.get("userRole"),
      staffRole: normalizeUserStaffRole(c.get("userStaffRole") ?? undefined),
    };
    const result = await container.pressArchiveReadService.listCoverage(
      {
        limit: query.limit,
        offset: query.offset,
        ...(query.year !== undefined ? { year: query.year } : {}),
        ...(query.q !== undefined ? { q: query.q } : {}),
      },
      viewer,
    );
    return c.json(serializePressArchiveListResult(result));
  });

  r.get("/day-media", optionalAuth, zValidator("query", pressDayMediaQuerySchema), async (c) => {
    const query = c.req.valid("query");
    const viewer = {
      role: c.get("userRole"),
      staffRole: normalizeUserStaffRole(c.get("userStaffRole") ?? undefined),
    };
    const data = await container.pressArchiveReadService.listDayMediaSales(query.limit, viewer);
    return c.json({
      data: data.map((row) => ({
        ...row,
        endTime: row.endTime?.toISOString() ?? null,
      })),
    });
  });

  r.get("/sitemap-freshness", optionalAuth, async (c) => {
    const viewer = {
      role: c.get("userRole"),
      staffRole: normalizeUserStaffRole(c.get("userStaffRole") ?? undefined),
    };
    const data = await container.pressArchiveReadService.getSitemapFreshness(viewer);
    return c.json({
      data: data.map((row) => ({
        ...row,
        lastModified: row.lastModified.toISOString(),
      })),
    });
  });

  return r;
}
