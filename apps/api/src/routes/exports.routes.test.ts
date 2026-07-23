import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { ContainerExportRoutesSlice } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createExportRoutes } from "./exports.js";

const userId = "user-1";

function buildContainer(exportHttp: ContainerExportRoutesSlice["compliance"]["exportHttp"]) {
  return {
    compliance: { exportHttp },
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
  } as unknown as ContainerExportRoutesSlice;
}

describe("export routes", () => {
  it("POST / returns sync CSV for small exports", async () => {
    const createExport = vi.fn().mockResolvedValue({
      kind: "sync_stream",
      contentType: "text/csv; charset=utf-8",
      filename: "lots-export-2026-05-28.csv",
      stream: (async function* () {
        yield "id\n1\n";
      })(),
    });

    const container = buildContainer({ createExport } as never);

    const authenticator: IAuthenticator = {
      getSessionUser: vi
        .fn()
        .mockResolvedValue({ id: userId, role: "staff", staffRole: "auction_manager" }),
    };

    const app = new Hono();
    app.route("/exports", createExportRoutes(container, authenticator));

    const res = await app.request("http://test/exports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityType: "lots", format: "csv", filters: {} }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(await res.text()).toContain("id");
    expect(createExport).toHaveBeenCalled();
  });

  it("POST / returns 202 for async exports", async () => {
    const createExport = vi.fn().mockResolvedValue({
      kind: "json",
      status: 202,
      body: {
        mode: "async",
        job: {
          id: "exp-1",
          entityType: "lots",
          format: "csv",
          status: "pending",
          progress: 0,
          createdAt: new Date().toISOString(),
        },
      },
    });

    const container = buildContainer({ createExport } as never);

    const authenticator: IAuthenticator = {
      getSessionUser: vi
        .fn()
        .mockResolvedValue({ id: userId, role: "staff", staffRole: "auction_manager" }),
    };

    const app = new Hono();
    app.route("/exports", createExportRoutes(container, authenticator));

    const res = await app.request("http://test/exports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityType: "lots", format: "csv", filters: {}, forceAsync: true }),
    });

    expect(res.status).toBe(202);
    const body = (await res.json()) as { mode: string; job: { id: string } };
    expect(body.mode).toBe("async");
    expect(body.job.id).toBe("exp-1");
  });

  it("POST / returns 403 for authz errors", async () => {
    const createExport = vi.fn().mockResolvedValue({
      kind: "json",
      status: 403,
      body: { error: "Finance export requires finance.read", code: "export_forbidden" },
    });

    const container = buildContainer({ createExport } as never);

    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue({ id: userId, role: "client", staffRole: null }),
    };

    const app = new Hono();
    app.route("/exports", createExportRoutes(container, authenticator));

    const res = await app.request("http://test/exports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityType: "payments", format: "csv", filters: {} }),
    });

    expect(res.status).toBe(403);
  });

  it("POST /preview returns estimated rows", async () => {
    const previewExport = vi.fn().mockResolvedValue({
      status: 200,
      body: { estimatedRows: 12, syncMaxRows: 5000 },
    });

    const container = buildContainer({ previewExport } as never);

    const authenticator: IAuthenticator = {
      getSessionUser: vi
        .fn()
        .mockResolvedValue({ id: userId, role: "staff", staffRole: "auction_manager" }),
    };

    const app = new Hono();
    app.route("/exports", createExportRoutes(container, authenticator));

    const res = await app.request("http://test/exports/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityType: "lots", filters: {} }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { estimatedRows: number; syncMaxRows: number };
    expect(body.estimatedRows).toBe(12);
    expect(body.syncMaxRows).toBe(5000);
  });
});
