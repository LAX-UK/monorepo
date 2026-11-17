// @vitest-environment jsdom
import type { AdminOrderDetail, AdminZohoMirrorStatus } from "@auction/shop-contracts";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/orders/o-1",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
  Toaster: () => null,
}));

const { OrderDetailView } = await import("./order-detail-view");
const { presentZohoMirror } = await import("@/server/domain/zoho-mirror.vm");

const ORDER_ID = "0f0e0d0c-0b0a-4908-8706-050403020100";
const NOW = new Date("2026-11-14T15:30:00.000Z");
const FAILED_JOBS = "https://bid.example.test/admin/failed-jobs?source=integrations";

const DETAIL = {
  orderId: ORDER_ID,
  reference: "LAX-10482",
  status: "paid",
  fulfilment: "unfulfilled",
  totalPence: 12_500,
  buyerSubjectId: "buyer-1",
  buyerName: "A. Sample",
  buyerEmail: "a.sample@example.test",
  stripeCheckoutSessionId: null,
  stripePaymentIntentId: null,
  paidAt: "2026-11-14T15:00:00.000Z",
  createdAt: "2026-11-14T14:55:00.000Z",
  lines: [],
  fulfilmentRecord: null,
  refunds: [],
  activity: [],
} as unknown as AdminOrderDetail;

const PERMISSIONS = {
  refund: false,
  fulfilment: false,
  production: false,
  swapAcrossOwners: false,
  eraseGuest: false,
};

function status(over: Partial<AdminZohoMirrorStatus>): AdminZohoMirrorStatus {
  return {
    entity: "order",
    id: ORDER_ID,
    state: "mirrored",
    consumer: "zoho_fulfilment",
    notApplicableReason: null,
    mode: "live",
    lastAttemptAt: "2026-11-14T16:02:00.000Z",
    nextRetryAt: null,
    attempts: 1,
    providerReference: null,
    error: null,
    ...over,
  };
}

function renderOrder(mirror: AdminZohoMirrorStatus | null, failedJobsHref: string | null = null) {
  return render(
    <OrderDetailView
      detail={DETAIL}
      permissions={PERMISSIONS}
      zohoMirror={presentZohoMirror(mirror, { now: NOW, failedJobsHref })}
    />,
  );
}

/** The header: the title's row, where the order's status badges sit. */
function headerRow() {
  const title = screen.getByRole("heading", { level: 1, name: "Order LAX-10482" });
  return title.parentElement as HTMLElement;
}

async function openDetails(name: string) {
  const badge = within(headerRow()).getByRole("button", { name });
  await act(async () => {
    badge.focus();
    fireEvent.click(badge);
  });
  return { badge, dialog: await screen.findByRole("dialog") };
}

beforeAll(() => {
  // A desk: the details open as a popover (a phone gets the kit's bottom sheet).
  window.matchMedia = ((query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

describe("the order page's Zoho badge", () => {
  it("sits beside the order's status as a button named with its state, and opens Mirrored's details", async () => {
    renderOrder(status({ providerReference: "LAX-S-10482" }));
    expect(within(headerRow()).getByText("Paid")).toBeInTheDocument();
    const { badge, dialog } = await openDetails("Zoho: Mirrored to Zoho, details");
    expect(badge.tagName).toBe("BUTTON");
    expect(dialog).toHaveAccessibleName("Mirrored to Zoho");
    expect(dialog).toHaveTextContent(
      "Mirrored to ZohoLast sent 14 Nov 2026, 16:02. Dispatch record LAX-S-10482.",
    );
    const sent = dialog.querySelector("time");
    expect(sent).toHaveTextContent("14 Nov 2026, 16:02");
    expect(sent).toHaveAttribute("datetime", "2026-11-14T16:02:00.000Z");
    expect(within(dialog).getByRole("button", { name: "Copy Zoho record ID" })).toBeVisible();
    expect(within(dialog).queryByRole("link")).not.toBeInTheDocument();

    fireEvent.keyDown(document.activeElement ?? dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(document.activeElement).toBe(badge);
  });

  it("says when it will try again while sending", async () => {
    renderOrder(status({ state: "pending", nextRetryAt: "2026-11-14T16:10:00.000Z" }));
    const { dialog } = await openDetails("Zoho: Sending to Zoho, details");
    expect(dialog).toHaveTextContent(
      "Sending to ZohoWaiting to send the latest change. Tries again at 16:10 (attempt 2).",
    );
    expect(dialog.querySelector("time")).toHaveAttribute("datetime", "2026-11-14T16:10:00.000Z");
  });

  it("links a failure to Failed jobs for someone who can open it", async () => {
    renderOrder(status({ state: "failed", error: "Zoho said the SKU is unknown" }), FAILED_JOBS);
    const { dialog } = await openDetails("Zoho: Not in Zoho, details");
    expect(dialog).toHaveTextContent(
      "Not in ZohoZoho refused the last change: Zoho said the SKU is unknown. Staff in Failed jobs can fix and replay it.",
    );
    const link = within(dialog).getByRole("link", { name: /^Open in Failed jobs/ });
    expect(link).toHaveAttribute("href", FAILED_JOBS);
  });

  it("leaves the Failed jobs link out for someone who cannot open it", async () => {
    renderOrder(status({ state: "failed" }));
    const { dialog } = await openDetails("Zoho: Not in Zoho, details");
    expect(within(dialog).queryByRole("link")).not.toBeInTheDocument();
  });

  it("explains a dry run", async () => {
    renderOrder(status({ state: "dry_run", mode: "dry_run" }));
    const { dialog } = await openDetails("Zoho: Zoho dry run, details");
    expect(dialog).toHaveTextContent(
      "Zoho dry runLAX worked out what it would send and wrote nothing to Zoho.",
    );
  });

  // Z3: the details are a dialog that takes focus in whatever it holds, and Esc gives it back.
  it.each([
    ["Mirrored", status({ providerReference: "LAX-S-10482" }), "Zoho: Mirrored to Zoho, details"],
    ["Sending", status({ state: "pending" }), "Zoho: Sending to Zoho, details"],
    ["Not in Zoho", status({ state: "failed" }), "Zoho: Not in Zoho, details"],
    ["Not in Zoho with its link", status({ state: "failed" }), "Zoho: Not in Zoho, details"],
    ["Zoho dry run", status({ state: "dry_run" }), "Zoho: Zoho dry run, details"],
  ] as const)(
    "moves focus to the %s details and back to the badge on Esc",
    async (who, mirror, name) => {
      renderOrder(mirror, who === "Not in Zoho with its link" ? FAILED_JOBS : null);
      const { badge, dialog } = await openDetails(name);
      await waitFor(() => expect(document.activeElement).toBe(dialog));
      fireEvent.keyDown(dialog, { key: "Escape" });
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(document.activeElement).toBe(badge);
    },
  );

  it("draws no badge for an order that is not mirrored, or when the read failed", () => {
    renderOrder(status({ state: "not_applicable", notApplicableReason: "not_paid", mode: null }));
    expect(within(headerRow()).queryByRole("button", { name: /^Zoho:/ })).not.toBeInTheDocument();
    renderOrder(null);
    expect(screen.queryAllByRole("button", { name: /^Zoho:/ })).toHaveLength(0);
  });
});
