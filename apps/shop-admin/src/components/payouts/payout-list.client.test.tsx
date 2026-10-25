// @vitest-environment jsdom
import type { AdminPayoutList } from "@auction/shop-contracts";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const markPayoutPaid = vi.fn();
const refresh = vi.fn();

vi.mock("@/server/application/admin-operations-actions.server", () => ({ markPayoutPaid }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh }),
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

// Radix menus open on pointer events jsdom does not send. This stand-in lists every item in the
// open menu, keeping each item's disabled state and select contract.
vi.mock("@auction/ui/components/dropdown-menu", () => {
  const Pass = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  return {
    DropdownMenu: Pass,
    DropdownMenuTrigger: Pass,
    DropdownMenuContent: ({ children }: { children?: React.ReactNode }) => (
      <div role="menu">{children}</div>
    ),
    DropdownMenuItem: ({
      children,
      disabled,
      onSelect,
    }: {
      children?: React.ReactNode;
      disabled?: boolean;
      onSelect?: () => void;
    }) => (
      // biome-ignore lint/a11y/useKeyWithClickEvents: a test stand-in for a Radix menu item
      <div
        role="menuitem"
        tabIndex={-1}
        aria-disabled={disabled ? "true" : undefined}
        onClick={onSelect}
      >
        {children}
      </div>
    ),
    DropdownMenuCheckboxItem: Pass,
    DropdownMenuRadioGroup: Pass,
    DropdownMenuRadioItem: Pass,
    DropdownMenuLabel: Pass,
    DropdownMenuSeparator: () => null,
  };
});

const { PayoutList } = await import("./payout-list.client");

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
  nextCursor: null,
};

function renderList(canMarkPaid = true) {
  return render(<PayoutList page={page} cursor={null} canMarkPaid={canMarkPaid} />);
}

const grid = () => screen.getByRole("grid", { name: "Payouts" });
const tableRow = (payee: string) => within(grid()).getByText(payee).closest("tr") as HTMLElement;

beforeEach(() => {
  markPayoutPaid.mockReset();
  refresh.mockReset();
  markPayoutPaid.mockResolvedValue({ ok: true, data: { id: "x", status: "paid" } });
});

describe("the payouts list", () => {
  it("reads statuses in words and dates in London, never as raw values or slash dates", () => {
    renderList();
    const table = grid();
    expect(within(table).getByText("Waiting for refund period")).toBeInTheDocument();
    expect(within(tableRow("Theo Marsh")).getByText("Due")).toBeInTheDocument();
    expect(within(tableRow("Theo Marsh")).getByText("2 Oct 2026")).toBeInTheDocument();
    expect(within(table).getByText("15 Oct 2036")).toBeInTheDocument();
    expect(table.textContent).not.toMatch(/pending_refund_period|\d{2}\/\d{2}\/\d{4}/);
    expect(within(table).getByText("£85.00")).toBeInTheDocument();
  });

  it("offers Mark paid on the due payout only", () => {
    renderList();
    expect(
      within(tableRow("Theo Marsh")).getByRole("button", {
        name: "Mark the payout to Theo Marsh as paid",
      }),
    ).toBeInTheDocument();
    for (const payee of ["Cavendish Gallery", "Ada Lee", "Old Gallery"]) {
      expect(
        within(tableRow(payee)).queryByRole("button", { name: /Mark the payout/ }),
      ).not.toBeInTheDocument();
    }
  });

  it("shows Mark as paid disabled, with its reason, while the refund period runs", () => {
    renderList();
    const blocked = within(tableRow("Cavendish Gallery")).getByRole("menuitem", {
      name: /Mark as paid/,
    });
    expect(blocked).toHaveAttribute("aria-disabled", "true");
    expect(blocked).toHaveTextContent("Payable once the refund period ends");
    // Paid and cancelled payouts have no payment action at all, not even a disabled one.
    expect(within(tableRow("Ada Lee")).queryByText(/Mark as paid/)).not.toBeInTheDocument();
    expect(within(tableRow("Old Gallery")).queryByText(/Mark as paid/)).not.toBeInTheDocument();
  });

  it("hides every payment action from a role that cannot pay", () => {
    renderList(false);
    expect(screen.queryByText(/Mark .*paid/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Mark the payout/ })).not.toBeInTheDocument();
  });
});

describe("marking a payout paid from its row", () => {
  function openDialog() {
    renderList();
    fireEvent.click(
      within(tableRow("Theo Marsh")).getByRole("button", {
        name: "Mark the payout to Theo Marsh as paid",
      }),
    );
    return screen.findByRole("dialog", { name: "Mark the payout to Theo Marsh as paid?" });
  }

  it("names the payee, the amount and the payout reference, and the button repeats the amount", async () => {
    const dialog = await openDialog();
    expect(within(dialog).getByText("Theo Marsh")).toBeInTheDocument();
    expect(within(dialog).getByText("£85.00")).toBeInTheDocument();
    expect(within(dialog).getByText("0f8b2c4e")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Mark £85.00 paid" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("asks for the transfer reference and sends nothing without one", async () => {
    const dialog = await openDialog();
    fireEvent.click(within(dialog).getByRole("button", { name: "Mark £85.00 paid" }));

    expect(
      await within(dialog).findByText("Enter the reference from the transfer."),
    ).toBeInTheDocument();
    expect(markPayoutPaid).not.toHaveBeenCalled();
    expect(within(dialog).getByLabelText("Paid reference")).toHaveAttribute("aria-invalid", "true");
  });

  it("limits the reference to what the API accepts", async () => {
    const dialog = await openDialog();
    expect(within(dialog).getByLabelText("Paid reference")).toHaveAttribute("maxlength", "120");
  });

  it("sends the payout, the reference and an idempotency key, then closes", async () => {
    const dialog = await openDialog();
    fireEvent.change(within(dialog).getByLabelText("Paid reference"), {
      target: { value: " FPS-20261024-01 " },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Mark £85.00 paid" }));

    await waitFor(() => expect(markPayoutPaid).toHaveBeenCalledTimes(1));
    expect(markPayoutPaid).toHaveBeenCalledWith({
      payoutId: "0f8b2c4e-1111-4222-8333-444455556666",
      paidReference: "FPS-20261024-01",
      idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(refresh).toHaveBeenCalled();
  });

  it("keeps the dialog open and offers to sign in again when a recent sign-in is needed", async () => {
    markPayoutPaid.mockResolvedValue({
      ok: false,
      kind: "step_up_required",
      message: "Recent authentication is required for this action",
    });
    const dialog = await openDialog();
    fireEvent.change(within(dialog).getByLabelText("Paid reference"), {
      target: { value: "FPS-1" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Mark £85.00 paid" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Recent authentication is required for this action",
    );
    expect(within(dialog).getByRole("link", { name: "Sign in again" })).toHaveAttribute(
      "href",
      "/api/auth/login?returnTo=%2Fpayouts",
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("repeats the same idempotency key when the same request is retried after a failure", async () => {
    markPayoutPaid.mockResolvedValue({ ok: false, kind: "failed", message: "Try again" });
    const dialog = await openDialog();
    fireEvent.change(within(dialog).getByLabelText("Paid reference"), {
      target: { value: "FPS-1" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Mark £85.00 paid" }));
    await waitFor(() => expect(markPayoutPaid).toHaveBeenCalledTimes(1));
    fireEvent.click(within(dialog).getByRole("button", { name: "Mark £85.00 paid" }));
    await waitFor(() => expect(markPayoutPaid).toHaveBeenCalledTimes(2));

    const keys = markPayoutPaid.mock.calls.map(([input]) => input.idempotencyKey);
    expect(keys[0]).toBe(keys[1]);
  });
});

describe("the payout panel", () => {
  it("opens from the row with the full record and the same Mark paid action", async () => {
    renderList();
    fireEvent.click(within(grid()).getByText("Theo Marsh"));

    const panel = await screen.findByRole("dialog", { name: /Payout to Theo Marsh/ });
    expect(within(panel).getByText("£100.00")).toBeInTheDocument();
    expect(within(panel).getByText("£15.00")).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole("button", { name: "Mark £85.00 paid" }));

    expect(
      await screen.findByRole("dialog", { name: "Mark the payout to Theo Marsh as paid?" }),
    ).toBeInTheDocument();
  });

  it("shows when and how a paid payout was paid, with no action", async () => {
    renderList();
    fireEvent.click(within(grid()).getByText("Ada Lee"));

    const panel = await screen.findByRole("dialog", { name: /Payout to Ada Lee/ });
    expect(within(panel).getByText("FPS-0920-01")).toBeInTheDocument();
    expect(within(panel).getByText("20 Sept 2026, 11:00")).toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: /Mark .* paid/ })).not.toBeInTheDocument();
  });

  it("explains why a payout in its refund period cannot be paid yet", async () => {
    renderList();
    fireEvent.click(within(grid()).getByText("Cavendish Gallery"));

    const panel = await screen.findByRole("dialog", { name: /Payout to Cavendish Gallery/ });
    const button = within(panel).getByRole("button", { name: "Mark £120.00 paid" });
    expect(button).toHaveAttribute("aria-disabled", "true");
  });
});
