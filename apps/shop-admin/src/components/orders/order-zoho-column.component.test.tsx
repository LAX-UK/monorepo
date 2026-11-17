// @vitest-environment jsdom
import { StaffAccessProvider } from "@auction/staff-ui";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/application/admin-zoho-mirror-actions.server", () => ({
  loadZohoMirrorCells: vi.fn(async () => {
    throw new Error("The test passes its own loader");
  }),
}));
vi.mock("@/lib/saved-views-port.client", () => ({
  createSavedViewsPort: () => ({
    load: async () => [],
    create: vi.fn(),
    rename: vi.fn(),
    remove: vi.fn(),
    reorder: vi.fn(),
  }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/orders",
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
  Toaster: () => null,
}));
// The real Display menu, so the column is shown the way staff show it.
vi.mock("@auction/ui/components/popover", async () =>
  (await import("@/test/radix-stubs")).popoverStub(),
);
vi.mock("@auction/ui/components/tooltip", async () =>
  (await import("@/test/radix-stubs")).tooltipStub(),
);

(await import("@/test/radix-stubs")).installLayoutStubs();
window.scrollTo = vi.fn() as typeof window.scrollTo;
const { OrderList } = await import("./order-list.client");
const { parseOrderListQuery } = await import("@/server/domain/order-list.vm");
const { presentZohoMirrorCell } = await import("@/server/domain/zoho-mirror.vm");
type Load = NonNullable<React.ComponentProps<typeof OrderList>["loadZohoMirror"]>;

const MIRRORED = "6c1c2d3e-0000-4000-8000-000000000001";
const SENDING = "6c1c2d3e-0000-4000-8000-000000000002";
const FAILED = "6c1c2d3e-0000-4000-8000-000000000003";
const DRY_RUN = "6c1c2d3e-0000-4000-8000-000000000004";
const UNPAID = "6c1c2d3e-0000-4000-8000-000000000005";
const IDS = [MIRRORED, SENDING, FAILED, DRY_RUN, UNPAID];
const COLUMNS_KEY = "staff.columns.orders";

function row(orderId: string, n: number) {
  return {
    orderId,
    reference: `LAX-S-100${n}`,
    status: "paid",
    totalPence: 12000,
    fulfilment: "none",
    buyerSubjectId: "buyer-1",
    buyerName: "A. Sample",
    buyerEmail: "a.sample@example.test",
    createdAt: "2026-11-01T10:00:00.000Z",
    paidAt: "2026-11-01T10:05:00.000Z",
  };
}

function badgeFor(id: string, state: "mirrored" | "pending" | "failed" | "dry_run") {
  return presentZohoMirrorCell({
    entity: "order",
    id,
    state,
    consumer: "zoho_fulfilment",
    notApplicableReason: null,
    mode: "live",
    lastAttemptAt: null,
    nextRetryAt: null,
    attempts: 1,
    providerReference: null,
    error: null,
  });
}

const CELLS = {
  [MIRRORED]: badgeFor(MIRRORED, "mirrored"),
  [SENDING]: badgeFor(SENDING, "pending"),
  [FAILED]: badgeFor(FAILED, "failed"),
  [DRY_RUN]: badgeFor(DRY_RUN, "dry_run"),
  [UNPAID]: null,
};

function renderList(load: Load) {
  return render(
    <StaffAccessProvider access={{ can: () => true }}>
      <OrderList
        query={parseOrderListQuery({})}
        page={{
          items: IDS.map((id, n) => row(id, n + 1)) as never,
          nextCursor: null,
          counts: { paid: IDS.length },
        }}
        now="2026-11-14T10:00:00.000Z"
        loadZohoMirror={load}
      />
    </StaffAccessProvider>,
  );
}

function grid(): HTMLElement {
  return screen.getByRole("grid");
}

function tableRow(reference: string): HTMLElement {
  const cell = within(grid()).getByText(reference);
  return cell.closest("tr") as HTMLElement;
}

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

describe("the Orders list's Zoho column (Z1, TBL-12)", () => {
  it("is hidden by default, and a list with it hidden reads nothing from the Zoho ledger", async () => {
    const load = vi.fn<Load>(async () => CELLS);
    renderList(load);
    expect(within(grid()).queryByRole("columnheader", { name: "Zoho" })).toBeNull();
    await act(async () => {});
    expect(load).not.toHaveBeenCalled();
  });

  it("can be shown from Display, and then reads the page's badges once", async () => {
    const load = vi.fn<Load>(async () => CELLS);
    renderList(load);
    const display = screen.getByRole("button", { name: /Display/ });
    display.focus();
    fireEvent.keyDown(display, { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: "Zoho" }));
    expect(await within(grid()).findByRole("columnheader", { name: "Zoho" })).toBeVisible();
    await within(tableRow("LAX-S-1001")).findByText("Mirrored to Zoho");
    // The table and the phone list both draw the cell; the page is still asked about once.
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith("order", IDS);
    // Remembered in this browser (TBL-12).
    expect(JSON.parse(window.localStorage.getItem(COLUMNS_KEY) ?? "null")).toEqual([]);
  });

  it("shows each order's badge with the record's label, tone and cue, and nothing for one with nothing to mirror", async () => {
    window.localStorage.setItem(COLUMNS_KEY, "[]");
    renderList(async () => CELLS);
    const expected = [
      ["LAX-S-1001", "Mirrored to Zoho", "success", "check"],
      ["LAX-S-1002", "Sending to Zoho", "info", "dot"],
      ["LAX-S-1003", "Not in Zoho", "danger", "alert"],
      ["LAX-S-1004", "Zoho dry run", "neutral", "ring"],
    ] as const;
    for (const [reference, label, tone, shape] of expected) {
      const badge = await within(tableRow(reference)).findByText(label);
      const pill = badge.closest("[data-tone]") as HTMLElement;
      expect(pill).toHaveAttribute("data-tone", tone);
      expect(pill.querySelector("[data-shape]")).toHaveAttribute("data-shape", shape);
    }
    const unpaid = tableRow("LAX-S-1005");
    expect(within(unpaid).queryByText(/Zoho/)).toBeNull();
    // The table's "None" dash, as every empty cell.
    expect(within(unpaid).getAllByText("—").length).toBeGreaterThan(0);
  });

  it("stays blank, claiming nothing, when the read fails", async () => {
    window.localStorage.setItem(COLUMNS_KEY, "[]");
    const load = vi.fn<Load>(async () => null);
    renderList(load);
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(within(grid()).queryByText(/to Zoho|Not in Zoho|Zoho dry run/)).toBeNull();
  });
});
