import { describe, expect, it, vi } from "vitest";

const { fetchAdminJson, loadAdminSession, loadBidAdminUrl, redirect, notFound } = vi.hoisted(
  () => ({
    fetchAdminJson: vi.fn(),
    loadAdminSession: vi.fn(),
    loadBidAdminUrl: vi.fn(),
    redirect: vi.fn((to: string) => {
      throw new Error(`redirect:${to}`);
    }),
    notFound: vi.fn(() => {
      throw new Error("not-found");
    }),
  }),
);
vi.mock("@/server/application/load-admin-data", () => ({ fetchAdminJson, loadAdminSession }));
vi.mock("@/server/application/load-bid-admin-url", () => ({ loadBidAdminUrl }));
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

function respond(status: { status: string; data?: unknown }) {
  vi.clearAllMocks();
  loadAdminSession.mockResolvedValue({ status: "ok", data: { capabilities: [] } });
  loadBidAdminUrl.mockResolvedValue("https://bid-admin.example.test/");
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
    expect(loadBidAdminUrl).not.toHaveBeenCalled();
  });

  it("links a failure to Failed jobs in Bid admin when Bid says the person can open it", async () => {
    respond({ status: "ok", data: mirror("failed") });
    expect(await zohoMirrorProp()).toMatchObject({
      state: "failed",
      failedJobsHref: "https://bid-admin.example.test/admin/failed-jobs",
    });
  });

  it("leaves the link out when Bid gives no Bid admin for the person", async () => {
    respond({ status: "ok", data: mirror("failed") });
    loadBidAdminUrl.mockResolvedValue(null);
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
