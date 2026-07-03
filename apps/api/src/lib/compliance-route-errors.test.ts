import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import {
  COMPLIANCE_ROUTE_ERROR_MAP,
  type ComplianceRouteErrorCode,
  respondComplianceRouteError,
} from "./compliance-route-errors.js";

async function requestMappedError(err: unknown, path = "/") {
  const app = new Hono();
  app.get(path, (c) => {
    const res = respondComplianceRouteError(c, err);
    return res ?? c.json({ error: "unhandled" }, 500);
  });
  return app.request(path);
}

describe("COMPLIANCE_ROUTE_ERROR_MAP", () => {
  it.each(
    Object.entries(COMPLIANCE_ROUTE_ERROR_MAP) as Array<
      [ComplianceRouteErrorCode, (typeof COMPLIANCE_ROUTE_ERROR_MAP)[ComplianceRouteErrorCode]]
    >,
  )("maps %s to HTTP %i with stable error body", async (code, status) => {
    const res = await requestMappedError(new Error(code), `/${code}`);
    expect(res.status).toBe(status);
    await expect(res.json()).resolves.toEqual({ error: code });
  });
});

describe("respondComplianceRouteError", () => {
  it("returns null for unmapped errors so routes can rethrow", async () => {
    const app = new Hono();
    app.get("/", (c) => {
      const res = respondComplianceRouteError(c, new Error("unexpected_compliance_error"));
      expect(res).toBeNull();
      return c.json({ ok: true });
    });
    const res = await app.request("/");
    expect(res.status).toBe(200);
  });

  it("returns null for non-Error throws", async () => {
    const app = new Hono();
    app.get("/", (c) => {
      const res = respondComplianceRouteError(c, "string_failure");
      expect(res).toBeNull();
      return c.json({ ok: true });
    });
    const res = await app.request("/");
    expect(res.status).toBe(200);
  });
});
