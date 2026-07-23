import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createAdminRoutes } from "./admin.js";

const staffUserId = "staff-user-id";

function createOpsDashboardContainer(partial: {
  onboardingIssues?: Container["admin"]["onboardingIssues"];
  legalEntityBrowse?: Container["admin"]["legalEntityBrowse"];
  financeIssueSnapshot?: Container["admin"]["financeIssueSnapshot"];
}) {
  return {
    env: { LOG_LEVEL: "silent", NODE_ENV: "test" } as never,
    admin: {
      requestLifecycle: {
        isSuspended: vi.fn().mockResolvedValue(false),
        reconcileAdminRequestCookie: vi.fn().mockResolvedValue(undefined),
      },
      financeIssueSnapshot:
        partial.financeIssueSnapshot ?? ({ getFinanceIssueSnapshot: vi.fn() } as never),
      onboardingIssues: partial.onboardingIssues,
      legalEntityBrowse: partial.legalEntityBrowse,
      stripeConnectRequirements: { listEntities: vi.fn().mockResolvedValue([]) },
    },
  } as unknown as Container;
}

describe("admin ops dashboard routes", () => {
  it("GET /onboarding-issues returns paginated rows with cross-lens summary", async () => {
    const getPage = vi.fn().mockResolvedValue({
      tab: "entities",
      rows: [
        {
          id: "le-1",
          displayName: "Gallery",
          status: "under_review",
          createdAt: new Date("2026-01-01T00:00:00Z"),
          updatedAt: new Date("2026-01-02T00:00:00Z"),
          statusChangedAt: null,
        },
      ],
      total: 4,
      limit: 50,
      offset: 0,
      summary: {
        queueTotal: 10,
        entities: 4,
        artists: 2,
        kyc: 1,
        organizations: 2,
        documents: 1,
      },
      lensSummary: {
        tab: "entities",
        summary: { total: 4, docsReceived: 1, underReview: 3 },
      },
    });
    const container = createOpsDashboardContainer({
      onboardingIssues: { getPage, getSelectedItem: vi.fn() } as never,
    });
    const authenticator: IAuthenticator = {
      getSessionUser: vi
        .fn()
        .mockResolvedValue({ id: staffUserId, role: "staff", staffRole: "operations" }),
    };
    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request(
      "http://test/admin/onboarding-issues?tab=entities&limit=50&offset=0",
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: Array<{ id: string }>;
      meta: {
        tab: string;
        total: number;
        summary: { queueTotal: number; entities: number };
        lensSummary: { tab: string; summary: { underReview: number } };
      };
    };
    expect(body.data).toHaveLength(1);
    expect(body.meta.total).toBe(4);
    expect(body.meta.summary.queueTotal).toBe(10);
    expect(body.meta.lensSummary.summary.underReview).toBe(3);
    expect(getPage).toHaveBeenCalledWith({
      tab: "entities",
      limit: 50,
      offset: 0,
    });
  });

  it("GET /onboarding-issues/selected returns a single lens row", async () => {
    const getSelectedItem = vi.fn().mockResolvedValue({
      id: "le-2",
      displayName: "Studio",
      status: "docs_received",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-02T00:00:00Z"),
      statusChangedAt: null,
    });
    const container = createOpsDashboardContainer({
      onboardingIssues: { getPage: vi.fn(), getSelectedItem } as never,
    });
    const authenticator: IAuthenticator = {
      getSessionUser: vi
        .fn()
        .mockResolvedValue({ id: staffUserId, role: "staff", staffRole: "operations" }),
    };
    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request(
      "http://test/admin/onboarding-issues/selected?tab=entities&id=550e8400-e29b-41d4-a716-446655440000",
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { id: string } };
    expect(body.data.id).toBe("le-2");
    expect(getSelectedItem).toHaveBeenCalledWith({
      tab: "entities",
      id: "550e8400-e29b-41d4-a716-446655440000",
    });
  });

  it("GET /legal-entities/browse returns rows with meta.summary", async () => {
    const getPage = vi.fn().mockResolvedValue({
      rows: [{ id: "le-1", displayName: "Gallery", status: "approved" }],
      total: 2,
      limit: 25,
      offset: 0,
      summary: {
        total: 2,
        byStatus: {
          lead: 0,
          docs_requested: 0,
          docs_received: 0,
          under_review: 0,
          connect_pending: 0,
          approved: 2,
          restricted: 0,
          rejected: 0,
          archived: 0,
        },
        stripeDueCount: 1,
        byKind: { individual: 0, organisation: 2 },
      },
    });
    const container = createOpsDashboardContainer({
      legalEntityBrowse: { getPage, searchLegalEntitiesBrowse: vi.fn() } as never,
    });
    const authenticator: IAuthenticator = {
      getSessionUser: vi
        .fn()
        .mockResolvedValue({ id: staffUserId, role: "staff", staffRole: "operations" }),
    };
    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));

    const res = await app.request("http://test/admin/legal-entities/browse?limit=25&offset=0");

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: Array<{ id: string }>;
      meta: {
        total: number;
        summary: { stripeDueCount: number; byKind: { organisation: number } };
      };
    };
    expect(body.data).toHaveLength(1);
    expect(body.meta.total).toBe(2);
    expect(body.meta.summary.stripeDueCount).toBe(1);
    expect(getPage).toHaveBeenCalledWith({ limit: 25, offset: 0 });
  });
});
