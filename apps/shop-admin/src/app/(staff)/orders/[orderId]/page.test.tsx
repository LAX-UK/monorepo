import type { StaffToolsAnswer } from "@/server/ports/staff-tools-access";
import { describe, expect, it, vi } from "vitest";

const { fetchAdminJson, loadAdminSession, toolsFor, redirect, notFound } = vi.hoisted(() => ({
  fetchAdminJson: vi.fn(),
  loadAdminSession: vi.fn(),
  toolsFor: vi.fn(),
  redirect: vi.fn((to: string) => {
    throw new Error(`redirect:${to}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
}));
vi.mock("@/server/application/load-admin-data", () => ({ fetchAdminJson, loadAdminSession }));
// The real "may this person open Failed jobs" path, down to Bid's answer for the session.
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "session-1" }) }),
}));
vi.mock("@/server/container", () => ({
  getShopAdminContainer: () => ({
    config: { NODE_ENV: "test", bidPublicUrl: "https://bid.example.test" },
    sessions: { get: async () => ({ subject: "staff-1", idToken: "id-token" }) },
    staffTools: { toolsFor },
  }),
}));
vi.mock("next/navigation", () => ({ redirect, notFound }));
vi.mock("@/components/orders/order-detail-view", () => ({
  OrderDetailView: () => null,
  orderPermissions: () => ({
    refund: false,
    fulfilment: false,
    production: false,
    swapAcrossOwners: false,
    eraseGuest: false,
  }),
}));

const { default: OrderDetailPage } = await import("./page");

const ORDER_ID = "0f0e0d0c-0b0a-4908-8706-050403020100";
const STATUS_PATH = `zoho-mirror/status?entity=order&id=${ORDER_ID}`;
const DETAIL = { orderId: ORDER_ID, reference: "LAX-10482", lines: [], buyerIsGuest: false };

function mirror(state: string) {
  return {
    entity: "order",
    id: ORDER_ID,
    state,
    consumer: "zoho_fulfilment",
    notApplicableReason: state === "not_applicable" ? "not_paid" : null,
    mode: "live",
    lastAttemptAt: "2026-11-14T16:02:00.000Z",
    nextRetryAt: null,
    attempts: 1,
    providerReference: null,
    error: null,
  };
}

const BID_ANSWER = {
  administrator: {
    status: "ok",
    tools: ["bid-admin", "lax-admin"],
    failedJobSources: [
      "background_jobs",
      "integrations.xero",
      "integrations.zoho",
      "integrations.books",
      "integrations.other",
    ],
  },
  read_only: {
    status: "ok",
    tools: ["bid-admin", "lax-admin"],
    failedJobSources: [
      "background_jobs",
      "integrations.xero",
      "integrations.zoho",
      "integrations.other",
    ],
  },
  finance: {
    status: "ok",
    tools: ["bid-admin", "lax-admin"],
    failedJobSources: ["integrations.xero", "integrations.books"],
  },
  specialist: { status: "ok", tools: ["bid-admin", "lax-admin"], failedJobSources: [] },
  shopOnly: { status: "ok", tools: ["lax-admin"], failedJobSources: [] },
} satisfies Record<string, StaffToolsAnswer>;

function respond(status: { status: string; data?: unknown }) {
  vi.clearAllMocks();
  loadAdminSession.mockResolvedValue({ status: "ok", data: { capabilities: [] } });
  toolsFor.mockResolvedValue(BID_ANSWER.administrator);
  fetchAdminJson.mockImplementation(async (path: string) =>
    path === STATUS_PATH ? status : { status: "ok", data: DETAIL },
  );
}

async function zohoMirrorProp() {
  const element = (await OrderDetailPage({ params: Promise.resolve({ orderId: ORDER_ID }) })) as {
    props: { zohoMirror: { state: string; failedJobsHref: string | null } | null };
  };
  return element.props.zohoMirror;
}

describe("Order page, the Zoho badge", () => {
  it("reads the order's Zoho status alongside the order, not after it", async () => {
    respond({ status: "ok", data: mirror("mirrored") });
    let ordersInFlight = 0;
    const seenWhileOrderInFlight: string[] = [];
    fetchAdminJson.mockImplementation(async (path: string) => {
      if (path === `orders/${ORDER_ID}`) {
        ordersInFlight++;
        await new Promise((resolve) => setTimeout(resolve, 0));
        ordersInFlight--;
        return { status: "ok", data: DETAIL };
      }
      if (ordersInFlight > 0) seenWhileOrderInFlight.push(path);
      return { status: "ok", data: mirror("mirrored") };
    });
    expect(await zohoMirrorProp()).toMatchObject({ state: "mirrored", failedJobsHref: null });
    expect(seenWhileOrderInFlight).toContain(STATUS_PATH);
    expect(fetchAdminJson.mock.calls.filter(([path]) => path === STATUS_PATH)).toHaveLength(1);
    expect(toolsFor).not.toHaveBeenCalled();
  });

  // One case per kind of person: what Bid answers for them (its `myFailedJobSources`, from the
  // Failed jobs access table) and whether "Open in Failed jobs" is drawn (Q7, PRM-1).
  it.each([
    ["a Bid administrator", "administrator", true],
    ["a Bid read-only staff member", "read_only", true],
    ["Bid finance, who opens Failed jobs for Xero and Books only", "finance", false],
    ["a Bid specialist, who opens Bid admin but not Failed jobs", "specialist", false],
    ["LAX Admin staff with no Bid role", "shopOnly", false],
  ] as const)("for %s, the link is drawn: %s", async (_who, role, linked) => {
    respond({ status: "ok", data: mirror("failed") });
    toolsFor.mockResolvedValue(BID_ANSWER[role]);
    expect(await zohoMirrorProp()).toMatchObject({
      state: "failed",
      failedJobsHref: linked
        ? "https://bid.example.test/admin/failed-jobs?source=integrations"
        : null,
    });
    expect(toolsFor).toHaveBeenCalledTimes(1);
  });

  it("leaves the link out when Bid cannot say what the person may open", async () => {
    respond({ status: "ok", data: mirror("failed") });
    toolsFor.mockResolvedValue({ status: "unavailable" });
    expect(await zohoMirrorProp()).toMatchObject({ state: "failed", failedJobsHref: null });
    toolsFor.mockRejectedValue(new Error("Bid is down"));
    expect(await zohoMirrorProp()).toMatchObject({ state: "failed", failedJobsHref: null });
  });

  it.each(["failed", "forbidden", "not_found"])(
    "still shows the order, without a badge, when the Zoho read is %s",
    async (status) => {
      respond({ status });
      expect(await zohoMirrorProp()).toBeNull();
    },
  );

  it("draws no badge for an order with nothing to mirror", async () => {
    respond({ status: "ok", data: mirror("not_applicable") });
    expect(await zohoMirrorProp()).toBeNull();
  });
});
