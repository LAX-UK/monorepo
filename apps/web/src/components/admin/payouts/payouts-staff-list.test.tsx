import {
  PAYOUTS_DEFAULT_SORT,
  type PayoutsStaffRow,
} from "@/lib/admin/finance/payouts-staff-list.vm";
import { EMPTY_ADMIN_PAYOUT_LIST_SUMMARY } from "@/lib/data/http/admin-payouts.shared";
import { resetRowLinks, visits } from "@/test/row-link";
import { StaffTooltipProvider } from "@auction/staff-ui";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PayoutsStaffList, type PayoutsStaffListProps } from "./payouts-staff-list";

const push = vi.fn();

vi.mock("next/link", async () => (await import("@/test/row-link")).nextLinkMock());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push, replace: vi.fn() }),
  usePathname: () => "/admin/payouts",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/actions/admin/admin-payouts", () => ({
  adminMarkPayoutPaidResultAction: vi.fn(),
  adminRetryPayoutTransferResultAction: vi.fn(),
  adminAddPayoutAdjustmentResultAction: vi.fn(),
  adminReversePayoutResultAction: vi.fn(),
  adminAdoptBlockedPayoutTransferResultAction: vi.fn(),
  adminReleaseBlockedPayoutResultAction: vi.fn(),
}));
vi.mock("@/lib/ui/notify", () => ({ notify: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/auth/step-up/use-step-up-coordinator", () => ({
  redirectToHostedReauth: vi.fn(),
}));
vi.mock("@/components/exports/export-button", () => ({ ExportButton: () => null }));

function payout(n: number): PayoutsStaffRow {
  const month = String(13 - n).padStart(2, "0");
  return {
    id: `payout_${n}`,
    reference: `PO-2026-00000${n}`,
    legalEntityId: `entity_${n}`,
    seller: `Seller ${n}`,
    period: `Period ${n}`,
    hammer: "",
    oldRule: false,
    periodStart: `2026-${month}-01T00:00:00.000Z`,
    gross: "£5,000.00",
    platformFee: "£500.00",
    stripeFee: "£0.00",
    net: `£${n},000.00`,
    netPence: n * 100_000,
    status: "scheduled",
    statusPresentation: { label: "Scheduled", tone: "info" },
    stripeTransferId: null,
    failureReason: null,
    statementError: null,
    paidAt: null,
    createdAt: "2026-11-01T00:00:00.000Z",
    canMarkPaid: true,
    canAdjust: true,
    canReverse: false,
    canRetryTransfer: false,
    canResolveBlocked: false,
  };
}

const rows = Array.from({ length: 12 }, (_, index) => payout(index + 1));
const LIST = "/admin/payouts?status=scheduled";

function renderList(patch: Partial<PayoutsStaffListProps> = {}) {
  const props: PayoutsStaffListProps = {
    search: { status: "scheduled" },
    view: "scheduled",
    sort: PAYOUTS_DEFAULT_SORT,
    rows,
    summary: EMPTY_ADMIN_PAYOUT_LIST_SUMMARY,
    disputesOpen: 0,
    capabilities: { canProcess: true, canReverse: true },
    sellerFilterName: null,
    exportFilters: {},
    pageSize: 50,
    pagination: null,
    loadError: null,
    ...patch,
  };
  return render(
    <StaffTooltipProvider>
      <PayoutsStaffList {...props} />
    </StaffTooltipProvider>,
  );
}

/** The period link in the table layout (the phone layout renders the same links). */
const titleLink = (period: string) =>
  within(screen.getByRole("grid", { name: "Payouts", hidden: true })).getByRole("link", {
    name: period,
    hidden: true,
  });
const rowOf = (period: string) => titleLink(period).closest("tr") as HTMLElement;
const dialog = () => screen.getByRole("dialog");
const address = () => `${window.location.pathname}${window.location.search}`;
const position = () =>
  within(dialog()).getByText(
    (_, element) => element?.hasAttribute("data-staff-queue-position") ?? false,
  );

describe("PayoutsStaffList queue panel", () => {
  beforeEach(() => {
    resetRowLinks();
    push.mockClear();
    window.history.replaceState(null, "", LIST);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens from a row with the payout in the URL, and its place in the list", async () => {
    const pushState = vi.spyOn(window.history, "pushState");
    renderList();
    expect(titleLink("Period 3")).toHaveAttribute("href", `${LIST}&payout=payout_3`);
    fireEvent.click(titleLink("Period 3"));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(within(dialog()).getByRole("heading", { name: "Payout for Period 3" })).toBeVisible();
    expect(address()).toBe(`${LIST}&payout=payout_3`);
    expect(pushState).toHaveBeenCalledTimes(1);
    // The panel opened in place: no visit to another page.
    expect(visits).not.toHaveBeenCalled();
    expect(position()).toHaveTextContent("3 of 12 in this queue");
  });

  it("reopens from its URL, as a shared link or a reload does", async () => {
    window.history.replaceState(null, "", `${LIST}&payout=payout_5`);
    renderList({ search: { status: "scheduled", payout: "payout_5" } });
    expect(
      within(await screen.findByRole("dialog")).getByRole("heading", {
        name: "Payout for Period 5",
      }),
    ).toBeInTheDocument();
    expect(position()).toHaveTextContent("5 of 12");
  });

  it("opens a linked payout that is not on the page shown, without a place to step from", async () => {
    window.history.replaceState(null, "", `${LIST}&payout=payout_40`);
    renderList({
      search: { status: "scheduled", payout: "payout_40" },
      openOffPage: { ...payout(4), id: "payout_40", period: "Period 40" },
    });
    const panel = await screen.findByRole("dialog");
    expect(within(panel).getByRole("heading", { name: "Payout for Period 40" })).toBeVisible();
    expect(within(panel).queryByRole("button", { name: "Next payout" })).toBeNull();
  });

  it("steps with J and K and the arrow buttons without closing or adding history", async () => {
    const pushState = vi.spyOn(window.history, "pushState");
    renderList();
    fireEvent.click(titleLink("Period 3"));
    await screen.findByRole("dialog");
    fireEvent.keyDown(dialog(), { key: "j" });
    expect(within(dialog()).getByRole("heading", { name: "Payout for Period 4" })).toBeVisible();
    expect(address()).toBe(`${LIST}&payout=payout_4`);
    expect(position()).toHaveTextContent("4 of 12");
    fireEvent.keyDown(dialog(), { key: "k" });
    fireEvent.keyDown(dialog(), { key: "k" });
    expect(within(dialog()).getByRole("heading", { name: "Payout for Period 2" })).toBeVisible();
    fireEvent.click(within(dialog()).getByRole("button", { name: "Next payout" }));
    expect(within(dialog()).getByRole("heading", { name: "Payout for Period 3" })).toBeVisible();
    expect(pushState).toHaveBeenCalledTimes(1);
    // The footer follows the payout shown; its money actions are the row's, unchanged.
    expect(within(dialog()).getByRole("button", { name: "Mark £3,000.00 paid" })).toBeVisible();
    expect(rowOf("Period 3")).toHaveAttribute("data-active");
  });

  it("stops at the ends of the list rather than wrapping round", async () => {
    window.history.replaceState(null, "", `${LIST}&payout=payout_12`);
    renderList({ search: { status: "scheduled", payout: "payout_12" } });
    const next = within(await screen.findByRole("dialog")).getByRole("button", {
      name: "Next payout",
    });
    expect(next).toHaveAttribute("aria-disabled", "true");
    fireEvent.keyDown(dialog(), { key: "j" });
    expect(within(dialog()).getByRole("heading", { name: "Payout for Period 12" })).toBeVisible();
  });

  it("closes on Back", async () => {
    renderList();
    fireEvent.click(titleLink("Period 3"));
    await screen.findByRole("dialog");
    act(() => {
      window.history.replaceState(null, "", LIST);
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("closes on Esc by stepping back over its entry, and returns focus to the row last shown", async () => {
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    renderList();
    titleLink("Period 5").focus();
    fireEvent.click(titleLink("Period 5"));
    await screen.findByRole("dialog");
    fireEvent.keyDown(dialog(), { key: "j" });
    fireEvent.keyDown(dialog(), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(back).toHaveBeenCalledTimes(1);
    expect(rowOf("Period 6")).toHaveFocus();
  });

  it("clears the payout from the URL on close when the panel was opened from a link", async () => {
    window.history.replaceState(null, "", `${LIST}&payout=payout_2`);
    renderList({ search: { status: "scheduled", payout: "payout_2" } });
    fireEvent.keyDown(await screen.findByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(address()).toBe(LIST);
  });

  it("opens the list with the payout's panel in a new tab, as no payout page exists yet", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    renderList();
    fireEvent.click(within(rowOf("Period 2")).getByText("PO-2026-000002"), { metaKey: true });
    expect(open).toHaveBeenCalledWith(`${LIST}&payout=payout_2`, "_blank", "noopener");
    expect(screen.queryByRole("dialog")).toBeNull();
    await screen.findByRole("grid", { name: "Payouts", hidden: true });
    // No "Open full page" until a payout has a page of its own.
    fireEvent.click(titleLink("Period 2"));
    expect(
      within(await screen.findByRole("dialog")).queryByRole("link", { name: "Open full page" }),
    ).toBeNull();
    // Another record's link is not in the header: it is in the `…` menu.
    expect(within(dialog()).queryByRole("link", { name: "Open seller" })).toBeNull();
    fireEvent.keyDown(
      within(dialog()).getByRole("button", { name: /^More actions for the payout to/ }),
      { key: "Enter" },
    );
    expect(
      within(screen.getByRole("menu")).getByRole("menuitem", { name: "Open seller" }),
    ).toHaveAttribute("href", "/admin/legal-entities/entity_2");
  });

  it("sorts in the URL, so the queue steps in the order shown", () => {
    renderList();
    fireEvent.click(screen.getByRole("button", { name: /^Net/ }));
    expect(push).toHaveBeenCalledWith("/admin/payouts?status=scheduled&sort=-net", {
      scroll: false,
    });
  });
});
