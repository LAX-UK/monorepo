import { sharedCase } from "@/lib/admin/finance/dispute-case.fixture";
import { StaffTooltipProvider } from "@auction/staff-ui";
import type { DisputeDeskCase, DisputeDeskInvoice } from "@auction/types";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DisputeCaseView } from "./dispute-case-view";

const refresh = vi.fn();
const allocate = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin/disputes/case-1",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/actions/admin/admin-dispute-allocation", () => ({
  allocateDisputeResultAction: (input: unknown) => allocate(input),
}));
vi.mock("@/lib/ui/notify", () => ({ notify: { success: vi.fn(), error: vi.fn() } }));

/** The invoice list renders a table and a phone layout, so each field exists twice; use the first. */
const shareField = (name: string) => screen.getAllByRole("textbox", { name })[0] as HTMLElement;

const NOW = "2026-11-01T12:00:00.000Z";

function renderCase(
  found: DisputeDeskCase,
  access: { canAllocate?: boolean; canOpenClient?: boolean } = {},
) {
  return render(
    <StaffTooltipProvider>
      <DisputeCaseView
        found={found}
        nowIso={NOW}
        canAllocate={access.canAllocate ?? true}
        canOpenClient={access.canOpenClient ?? true}
      />
    </StaffTooltipProvider>,
  );
}

const inDays = (days: number) => new Date(Date.parse(NOW) + days * 86_400_000).toISOString();

beforeEach(() => {
  vi.clearAllMocks();
  allocate.mockResolvedValue({ ok: true });
});

describe("DisputeCaseView: a case waiting for allocation", () => {
  it("shows the amount, reason, status and both badges in the header", () => {
    renderCase(sharedCase());
    expect(
      screen.getByRole("heading", { level: 1, name: "£14,200.00 · Fraudulent" }),
    ).toBeVisible();
    expect(screen.getAllByText("Needs response").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Needs allocation").length).toBeGreaterThan(0);
  });

  it("starts with the shares split in proportion, adding up to the dispute", () => {
    renderCase(sharedCase());
    expect(shareField("Dispute share for Thames at low tide")).toHaveValue("8,600.00");
    expect(shareField("Dispute share for Red chair, evening")).toHaveValue("2,400.00");
    expect(screen.getByText("£14,200.00 of £14,200.00")).toBeVisible();
  });

  it("names every share field after its lot, in the table and in the phone layout", () => {
    renderCase(sharedCase());
    const fields = screen.getAllByRole("textbox");
    // Each invoice has a field in the table and one in the phone layout, where no column header exists.
    expect(fields).toHaveLength(6);
    for (const field of fields) {
      expect(field).toHaveAccessibleName(/^Dispute share for .+/);
    }
    for (const lot of ["Thames at low tide", "Study in blue and bone", "Red chair, evening"]) {
      expect(screen.getAllByRole("textbox", { name: `Dispute share for ${lot}` })).toHaveLength(2);
    }
  });

  it("shows what comes out of each seller's net share, and what the house bears", () => {
    renderCase(sharedCase());
    const effects = screen.getByRole("region", { name: "What this does to payouts" });
    expect(within(effects).getByText("Northbank Gallery")).toBeVisible();
    expect(within(effects).getByText("£10,620.00")).toBeVisible();
    expect(within(effects).getByText("Cedar & Stone Fine Art")).toBeVisible();
    expect(within(effects).getByText("£2,160.00")).toBeVisible();
    expect(within(effects).getByText("£1,420.00")).toBeVisible();
  });

  it("tells the person when the shares do not add up, and keeps Save available", async () => {
    renderCase(sharedCase());
    const field = shareField("Dispute share for Study in blue and bone");
    fireEvent.change(field, { target: { value: "2700" } });
    fireEvent.click(screen.getByRole("button", { name: "Save allocation" }));
    expect(await screen.findByText(/£500\.00 is left to allocate/)).toBeVisible();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(allocate).not.toHaveBeenCalled();
  });

  it("flags a share larger than its invoice", async () => {
    renderCase(sharedCase());
    const field = shareField("Dispute share for Red chair, evening");
    fireEvent.change(field, { target: { value: "5000" } });
    fireEvent.click(screen.getByRole("button", { name: "Save allocation" }));
    expect((await screen.findAllByText("More than the invoice total")).length).toBeGreaterThan(0);
  });

  it("restores the proportional split on request", async () => {
    renderCase(sharedCase());
    const field = shareField("Dispute share for Study in blue and bone");
    fireEvent.change(field, { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: "Split in proportion" }));
    expect(field).toHaveValue("3,200.00");
  });

  it("asks for a reason before saving, then sends the lines and the reason", async () => {
    renderCase(sharedCase());
    fireEvent.click(screen.getByRole("button", { name: "Save allocation" }));
    const dialog = await screen.findByRole("dialog", { name: "Save this allocation?" });
    expect(within(dialog).getByText(/already withdrawn £14,200\.00/)).toBeVisible();

    fireEvent.click(within(dialog).getByRole("button", { name: "Save allocation" }));
    expect(await within(dialog).findByText(/at least 10 characters/)).toBeVisible();
    expect(allocate).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByRole("textbox", { name: /Reason for this allocation/ }), {
      target: { value: "The buyer paid for all three lots in one checkout." },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save allocation" }));

    await waitFor(() => expect(allocate).toHaveBeenCalledTimes(1));
    expect(allocate).toHaveBeenCalledWith(
      expect.objectContaining({
        caseId: "case-1",
        expectedVersion: 1,
        note: "The buyer paid for all three lots in one checkout.",
        lines: [
          { paymentId: "p1", amountPence: 860_000 },
          { paymentId: "p2", amountPence: 320_000 },
          { paymentId: "p3", amountPence: 240_000 },
        ],
      }),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("keeps the dialog open and says why when the API refuses", async () => {
    allocate.mockResolvedValue({
      ok: false,
      error: "This dispute changed while you were working on it. Reload it and try again.",
    });
    renderCase(sharedCase());
    fireEvent.click(screen.getByRole("button", { name: "Save allocation" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox", { name: /Reason for this allocation/ }), {
      target: { value: "The buyer paid for all three lots in one checkout." },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save allocation" }));
    expect(await within(dialog).findByText("The allocation did not go through")).toBeVisible();
    expect(within(dialog).getByText(/changed while you were working/)).toBeVisible();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("warns when the evidence window has closed but still lets finance allocate", () => {
    renderCase(sharedCase({ dueBy: inDays(-1) }));
    expect(screen.getByText("The evidence window has closed")).toBeVisible();
    expect(screen.getByRole("button", { name: "Save allocation" })).toBeEnabled();
  });

  it("lists many invoices on one charge", () => {
    const base = sharedCase();
    const extra = Array.from({ length: 4 }, (_, i) => ({
      ...(base.invoices[0] as DisputeDeskInvoice),
      paymentId: `x${i}`,
      reference: `X${i}`,
      lotTitle: `Extra lot ${i}`,
      invoicePence: 100_000,
      platformFeePence: 10_000,
    }));
    renderCase(
      sharedCase({
        invoices: [...base.invoices, ...extra],
        invoiceCount: 7,
        amountPence: 1_820_000,
      }),
    );
    expect(shareField("Dispute share for Extra lot 3")).toBeVisible();
    expect(screen.getByText("£18,200.00 of £18,200.00")).toBeVisible();
  });
});

describe("DisputeCaseView: view-only", () => {
  it("lists the invoices, says the finance team allocates, and offers no way to save", () => {
    renderCase(sharedCase(), { canAllocate: false });
    expect(screen.getByText("View only")).toBeVisible();
    expect(screen.getByText("Not allocated yet")).toBeVisible();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save allocation" })).not.toBeInTheDocument();
    expect(screen.queryByText("Taken from seller")).not.toBeInTheDocument();
    expect(screen.getAllByText("£8,600.00").length).toBeGreaterThan(0);
  });
});

describe("DisputeCaseView: an allocated case", () => {
  const allocated = sharedCase({
    awaitingAllocation: false,
    allocationState: "allocated",
    allocations: [
      {
        paymentId: "p1",
        amountPence: 860_000,
        sellerSharePence: 774_000,
        clawback: "withdrawn",
        source: "staff",
        allocatedByName: "Hana Ito",
        allocatedAt: "2026-11-02T10:00:00.000Z",
      },
      {
        paymentId: "p2",
        amountPence: 320_000,
        sellerSharePence: 288_000,
        clawback: "withdrawn",
        source: "staff",
        allocatedByName: "Hana Ito",
        allocatedAt: "2026-11-02T10:00:00.000Z",
      },
    ],
    timeline: [
      {
        id: "allocated",
        kind: "allocated_by_staff",
        at: "2026-11-02T10:00:00.000Z",
        actor: "Hana Ito",
        invoiceCount: 2,
      },
      { id: "opened", kind: "opened", at: "2026-10-30T09:14:00.000Z", actor: "Stripe" },
    ],
  });

  it("shows the saved lines with what each did to its seller's payout, who saved it and when", () => {
    renderCase(allocated);
    expect(screen.getByText(/by Hana Ito/)).toBeVisible();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getAllByText("Taken from payout").length).toBeGreaterThan(0);
    expect(screen.queryByText("Red chair, evening")).not.toBeInTheDocument();
  });

  it("lists the history newest first", () => {
    renderCase(allocated);
    const history = screen.getByRole("list", { name: "Dispute history" });
    const items = within(history).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Allocated to 2 invoices");
    expect(items[1]).toHaveTextContent("Dispute opened by the card network");
  });
});

describe("DisputeCaseView: other cases", () => {
  it("explains a charge no payment matched", () => {
    renderCase(sharedCase({ invoiceCount: 0, invoices: [], buyerId: null, buyerLabel: null }));
    expect(screen.getByText("No payment matched this dispute")).toBeVisible();
    expect(screen.getAllByText("Unknown buyer").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Save allocation" })).not.toBeInTheDocument();
  });

  it("says a case that ended without a loss needs no allocation", () => {
    renderCase(
      sharedCase({
        status: "won",
        awaitingAllocation: false,
        closedAt: "2026-11-20T08:00:00.000Z",
      }),
    );
    expect(screen.getByText(/ended without a loss/)).toBeVisible();
    expect(screen.getByRole("heading", { name: "Outcome" })).toBeVisible();
  });

  it("says evidence is in once it is submitted", () => {
    renderCase(sharedCase({ evidenceSubmitted: true, status: "under_review" }));
    expect(screen.getByText("Submitted")).toBeVisible();
    expect(screen.getByText(/Evidence has been submitted/)).toBeVisible();
  });

  it("links the buyer only for someone who can open client pages", () => {
    const { unmount } = renderCase(sharedCase(), { canOpenClient: true });
    expect(screen.getByRole("link", { name: "Hartley Collection Ltd" })).toHaveAttribute(
      "href",
      "/admin/clients/u1",
    );
    unmount();
    renderCase(sharedCase(), { canOpenClient: false });
    expect(screen.queryByRole("link", { name: "Hartley Collection Ltd" })).not.toBeInTheDocument();
  });

  it("gives the Stripe case and charge in the side column", () => {
    renderCase(sharedCase());
    const rail = screen.getByRole("complementary", { name: "Case details" });
    expect(within(rail).getByText("dp_3Q7aL8")).toBeVisible();
    expect(within(rail).getByText("ch_3Q7aL8")).toBeVisible();
    expect(within(rail).getByText("Visa ending 4242")).toBeVisible();
    expect(within(rail).getByText("5 days left")).toBeVisible();
  });
});
