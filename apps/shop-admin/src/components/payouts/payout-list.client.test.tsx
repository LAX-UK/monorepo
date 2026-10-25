// @vitest-environment jsdom
import type { AdminPayoutList } from "@auction/shop-contracts";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const markPayoutPaid = vi.fn();
const refresh = vi.fn();
const push = vi.fn();

vi.mock("@/server/application/admin-operations-actions.server", () => ({ markPayoutPaid }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh }),
  usePathname: () => "/payouts",
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

vi.mock("@auction/ui/components/dropdown-menu", async () =>
  (await import("@/test/radix-stubs")).dropdownMenuStub(),
);

const { PayoutList } = await import("./payout-list.client");
const { payoutsList } = await import("@/server/domain/sales-lists.vm");

const row = (overrides: Partial<AdminPayoutList["items"][number]>) => ({
  payoutId: "0f8b2c4e-1111-4222-8333-444455556666",
  ownerPartyId: "22222222-2222-4222-8222-222222222222",
  ownerDisplayName: "Theo Marsh",
  source: "order_line",
  grossPence: 10000,
  deductionsPence: 1500,
  netPence: 8500,
  status: "due",
  payoutDueAt: "2026-10-02T09:30:00.000Z",
  paidAt: null,
  paidReference: null,
  createdAt: "2026-09-02T09:30:00.000Z",
  ...overrides,
});

const page: AdminPayoutList = {
  items: [
    row({}),
    row({
      payoutId: "1a000000-1111-4222-8333-444455556666",
      ownerDisplayName: "Cavendish Gallery",
      status: "pending_refund_period",
      netPence: 12000,
      payoutDueAt: "2036-10-15T09:30:00.000Z",
    }),
    row({
      payoutId: "2b000000-1111-4222-8333-444455556666",
      ownerDisplayName: "Ada Lee",
      status: "paid",
      netPence: 4000,
      paidAt: "2026-09-20T10:00:00.000Z",
      paidReference: "FPS-0920-01",
    }),
    row({
      payoutId: "3c000000-1111-4222-8333-444455556666",
      ownerDisplayName: "Old Gallery",
      status: "cancelled",
      netPence: 2500,
    }),
  ],
  nextCursor: "next-page",
  counts: { due: 1, pending_refund_period: 1, paid: 1, cancelled: 1 },
};

function renderList(canMarkPaid = true, query: Record<string, string> = {}) {
  return render(
    <PayoutList state={payoutsList.parse(query)} page={page} canMarkPaid={canMarkPaid} />,
  );
}

const grid = () => screen.getByRole("grid", { name: "Payouts" });
const tableRow = (payee: string) => within(grid()).getByText(payee).closest("tr") as HTMLElement;
const menuItem = (payee: string, name: RegExp) =>
  within(tableRow(payee)).queryByRole("menuitem", { name });

beforeEach(() => {
  markPayoutPaid.mockReset();
  refresh.mockReset();
  push.mockReset();
  markPayoutPaid.mockResolvedValue({ ok: true, data: { id: "x", status: "paid" } });
});

describe("the payouts list", () => {
  it("reads statuses in words, money formatted and dates in London", () => {
    renderList();
    const table = grid();
    expect(within(table).getByText("Waiting for refund period")).toBeInTheDocument();
    expect(within(tableRow("Theo Marsh")).getByText("Due")).toBeInTheDocument();
    expect(within(tableRow("Theo Marsh")).getByText("2 Oct 2026")).toBeInTheDocument();
    expect(table.textContent).not.toMatch(/pending_refund_period|\d{2}\/\d{2}\/\d{4}/);
    expect(within(table).getByText("£85.00")).toBeInTheDocument();
  });

  it("shows a view per status with its count, and sorts by the due date", () => {
    renderList();
    expect(screen.getByRole("link", { name: /Due\s*1/ })).toHaveAttribute(
      "href",
      "/payouts?view=due",
    );
    expect(screen.getByRole("columnheader", { name: /Due/ })).toHaveAttribute(
      "aria-sort",
      "descending",
    );
  });

  it("asks the server for the next page and keeps the view", () => {
    renderList(true, { view: "due" });
    expect(screen.getByRole("link", { name: /Next/ })).toHaveAttribute(
      "href",
      "/payouts?view=due&cursor=next-page",
    );
  });

  it("offers Mark paid in the menu of the due payout only", () => {
    renderList();
    expect(menuItem("Theo Marsh", /Mark £85.00 paid/)).toBeInTheDocument();
    expect(menuItem("Ada Lee", /Mark/)).not.toBeInTheDocument();
    expect(menuItem("Old Gallery", /Mark/)).not.toBeInTheDocument();
  });

  it("shows Mark paid disabled, with its reason, while the refund period runs", () => {
    renderList();
    const blocked = menuItem("Cavendish Gallery", /Mark £120.00 paid/);
    expect(blocked).toHaveAttribute("aria-disabled", "true");
    expect(blocked).toHaveTextContent("Payable once the refund period ends");
  });

  it("hides every payment action from a role that cannot pay", () => {
    renderList(false);
    expect(screen.queryByRole("menuitem", { name: /Mark .*paid/ })).not.toBeInTheDocument();
  });
});

describe("marking a payout paid", () => {
  async function openDialog() {
    renderList();
    const item = menuItem("Theo Marsh", /Mark £85.00 paid/);
    if (!item) throw new Error("no Mark paid item");
    fireEvent.click(item);
    return screen.findByRole("dialog", { name: "Mark the payout to Theo Marsh as paid?" });
  }

  it("names the payee, the amount and the reference, and starts on Cancel", async () => {
    const dialog = await openDialog();
    expect(within(dialog).getByText("Theo Marsh")).toBeInTheDocument();
    expect(within(dialog).getByText("£85.00")).toBeInTheDocument();
    expect(within(dialog).getByText("0f8b2c4e")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Mark £85.00 paid" })).toBeInTheDocument();
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus(),
    );
  });

  it("asks for the transfer reference and sends nothing without one", async () => {
    const dialog = await openDialog();
    fireEvent.click(within(dialog).getByRole("button", { name: "Mark £85.00 paid" }));
    expect(
      await within(dialog).findByText("Enter the reference from the transfer."),
    ).toBeInTheDocument();
    expect(markPayoutPaid).not.toHaveBeenCalled();
    expect(within(dialog).getByLabelText("Transfer reference")).toHaveAttribute("maxlength", "120");
  });

  it("sends the payout, the reference and an idempotency key, then closes", async () => {
    const dialog = await openDialog();
    fireEvent.change(within(dialog).getByLabelText("Transfer reference"), {
      target: { value: " FPS-20261024-01 " },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Mark £85.00 paid" }));

    await waitFor(() => expect(markPayoutPaid).toHaveBeenCalledTimes(1));
    expect(markPayoutPaid).toHaveBeenCalledWith({
      payoutId: "0f8b2c4e-1111-4222-8333-444455556666",
      paidReference: "FPS-20261024-01",
      idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Mark the payout to Theo Marsh as paid?" }),
      ).not.toBeInTheDocument(),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("asks the person to confirm it is them when the API needs a recent sign-in", async () => {
    markPayoutPaid.mockResolvedValue({
      ok: false,
      kind: "step_up_required",
      message: "Recent authentication is required for this action",
    });
    const dialog = await openDialog();
    fireEvent.change(within(dialog).getByLabelText("Transfer reference"), {
      target: { value: "FPS-1" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Mark £85.00 paid" }));

    const stepUp = await screen.findByRole("dialog", { name: "Confirm it’s you" });
    expect(stepUp).toHaveTextContent("To mark £85.00 paid, sign in again.");
    expect(within(stepUp).getByRole("button", { name: "Sign in again" })).toBeInTheDocument();
  });

  it("keeps a failure in the dialog and repeats the idempotency key on retry", async () => {
    markPayoutPaid.mockResolvedValue({ ok: false, kind: "failed", message: "Try again" });
    const dialog = await openDialog();
    fireEvent.change(within(dialog).getByLabelText("Transfer reference"), {
      target: { value: "FPS-1" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Mark £85.00 paid" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Try again");
    fireEvent.click(within(dialog).getByRole("button", { name: "Mark £85.00 paid" }));
    await waitFor(() => expect(markPayoutPaid).toHaveBeenCalledTimes(2));

    const keys = markPayoutPaid.mock.calls.map(([input]) => input.idempotencyKey);
    expect(keys[0]).toBe(keys[1]);
  });
});

describe("the payout panel", () => {
  it("opens from the URL with the full record and the same Mark paid action", async () => {
    renderList(true, { payout: "0f8b2c4e-1111-4222-8333-444455556666" });
    const panel = await screen.findByRole("dialog", { name: /Payout to Theo Marsh/ });
    expect(within(panel).getByText("£100.00")).toBeInTheDocument();
    expect(within(panel).getByText("−£15.00")).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole("button", { name: "Mark £85.00 paid" }));
    expect(
      await screen.findByRole("dialog", { name: "Mark the payout to Theo Marsh as paid?" }),
    ).toBeInTheDocument();
  });

  it("opens from the row and puts the record in the URL", async () => {
    renderList();
    fireEvent.click(within(grid()).getByRole("link", { name: "Ada Lee" }));
    const panel = await screen.findByRole("dialog", { name: /Payout to Ada Lee/ });
    expect(window.location.search).toBe("?payout=2b000000-1111-4222-8333-444455556666");
    expect(within(panel).getByText("FPS-0920-01")).toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: /Mark .* paid/ })).not.toBeInTheDocument();
  });

  it("explains why a payout in its refund period cannot be paid yet", async () => {
    renderList(true, { payout: "1a000000-1111-4222-8333-444455556666" });
    const panel = await screen.findByRole("dialog", { name: /Payout to Cavendish Gallery/ });
    expect(within(panel).getByRole("button", { name: "Mark £120.00 paid" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});
