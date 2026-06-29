import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createAdminRoutes } from "./admin.js";

const staffUserId = "staff-user-id";
const screeningId = "44444444-4444-4444-8444-444444444444";
const caseId = "55555555-5555-4555-8555-555555555555";
const docId = "66666666-6666-4666-8666-666666666666";

function createComplianceContainer(partial: {
  aml?: Container["admin"]["aml"];
  sourceOfFunds?: Container["admin"]["sourceOfFunds"];
}) {
  return {
    env: { LOG_LEVEL: "silent", NODE_ENV: "test" } as never,
    admin: {
      requestLifecycle: {
        isSuspended: vi.fn().mockResolvedValue(false),
        reconcileAdminRequestCookie: vi.fn().mockResolvedValue(undefined),
      },
      aml: partial.aml,
      sourceOfFunds: partial.sourceOfFunds,
    },
  } as unknown as Container;
}

describe("admin compliance routes (DIP facade)", () => {
  it("GET /compliance/aml/screenings returns pending rows with meta.total", async () => {
    const listPendingReviews = vi.fn().mockResolvedValue([{ id: screeningId }]);
    const countPendingReviews = vi.fn().mockResolvedValue(3);
    const container = createComplianceContainer({
      aml: { listPendingReviews, countPendingReviews } as never,
    });
    const authenticator: IAuthenticator = {
      getSessionUser: vi
        .fn()
        .mockResolvedValue({ id: staffUserId, role: "staff", staffRole: "compliance_officer" }),
    };
    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request("http://test/admin/compliance/aml/screenings?limit=50&offset=0");

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: Array<{ id: string }>;
      meta: { total: number; limit: number; offset: number };
    };
    expect(body.meta.total).toBe(3);
    expect(body.data).toHaveLength(1);
    expect(listPendingReviews).toHaveBeenCalledWith(50, 0);
    expect(countPendingReviews).toHaveBeenCalledOnce();
  });

  it("POST /compliance/aml/screenings/:id/decide maps aml_triage_required to 409", async () => {
    const decide = vi.fn().mockRejectedValue(new Error("aml_triage_required"));
    const container = createComplianceContainer({ aml: { decide } as never });
    const authenticator: IAuthenticator = {
      getSessionUser: vi
        .fn()
        .mockResolvedValue({ id: staffUserId, role: "staff", staffRole: "compliance_officer" }),
    };
    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request(
      `http://test/admin/compliance/aml/screenings/${screeningId}/decide`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision: "clear" }),
      },
    );

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "aml_triage_required" });
  });

  it("GET /compliance/source-of-funds returns enriched rows with meta.total", async () => {
    const listEnriched = vi.fn().mockResolvedValue({
      rows: [{ id: caseId, status: "pending" }],
      total: 1,
    });
    const container = createComplianceContainer({
      sourceOfFunds: { listEnriched } as never,
    });
    const authenticator: IAuthenticator = {
      getSessionUser: vi
        .fn()
        .mockResolvedValue({ id: staffUserId, role: "staff", staffRole: "compliance_officer" }),
    };
    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request(
      "http://test/admin/compliance/source-of-funds?limit=50&offset=0&status=pending",
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: Array<{ id: string }>;
      meta: { total: number; limit: number; offset: number };
    };
    expect(body.meta.total).toBe(1);
    expect(body.data[0]?.id).toBe(caseId);
    expect(listEnriched).toHaveBeenCalledWith("pending", 50, 0);
  });

  it("GET /compliance/source-of-funds/:id/documents/:docId/preview streams bytes with headers", async () => {
    const previewBytes = Buffer.from("pdf-bytes");
    const getStaffPreviewBytes = vi.fn().mockResolvedValue({
      buffer: previewBytes,
      contentType: "application/pdf",
      fileName: "bank-statement.pdf",
    });
    const container = createComplianceContainer({
      sourceOfFunds: {
        getStaffPreviewBytes,
        staffPreviewEnv: { WEB_ORIGIN: "http://test" },
      } as never,
    });
    const authenticator: IAuthenticator = {
      getSessionUser: vi
        .fn()
        .mockResolvedValue({ id: staffUserId, role: "staff", staffRole: "compliance_officer" }),
    };
    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request(
      `http://test/admin/compliance/source-of-funds/${caseId}/documents/${docId}/preview`,
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toContain("bank-statement.pdf");
    expect(Buffer.from(await res.arrayBuffer())).toEqual(previewBytes);
    expect(getStaffPreviewBytes).toHaveBeenCalledWith({
      caseId,
      documentId: docId,
      staffUserId,
      clientIp: null,
    });
  });
});
