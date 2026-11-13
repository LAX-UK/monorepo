import { accountingRow } from "@/lib/admin/finance/accounting-queue.fixture";
import { toAccountingStaffRows } from "@/lib/admin/finance/accounting-queue.vm";
import { StaffTooltipProvider } from "@auction/staff-ui";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountingQueueList, type AccountingQueueListProps } from "./accounting-queue-list";

const { tryAgain, refresh } = vi.hoisted(() => ({ tryAgain: vi.fn(), refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin/finance/accounting",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/actions/admin/admin-accounting", () => ({
  tryAgainAccountingDocumentAction: tryAgain,
}));

const rows = toAccountingStaffRows([
  accountingRow(),
  accountingRow({
    id: "doc-2",
    reference: "LAX-ART-CN-7",
    documentType: "credit_note",
    product: "lax_art",
    organisation: "london_art_exchange",
    lockedPeriod: true,
    problem: "The document's date is in a period that is locked in Books.",
  }),
]);
const counts = { needs_person: 4, failed: 2, waiting: 0, issued: 9 };

function renderList(patch: Partial<AccountingQueueListProps> = {}) {
  const props: AccountingQueueListProps = {
    search: {},
    tab: "failed",
    rows,
    counts,
    pageSize: 50,
    pagination: { summary: "1–2 of 2 documents", prevHref: null, nextHref: null },
    filtered: false,
    loadError: null,
    canAct: true,
    rehearsal: false,
    unreadable: 0,
    ...patch,
  };
  return render(
    <StaffTooltipProvider>
      <AccountingQueueList {...props} />
    </StaffTooltipProvider>,
  );
}

async function openActions(reference: string) {
  const [trigger] = screen.getAllByRole("button", {
    name: new RegExp(`Actions for .*${reference}`),
  });
  if (!trigger) throw new Error("no actions");
  fireEvent.keyDown(trigger, { key: "Enter" });
  return screen.findByRole("menu");
}

describe("AccountingQueueList", () => {
  beforeEach(() => {
    tryAgain.mockReset();
    refresh.mockReset();
  });

  it("lists each document with its reference, type, company, amount and problem", () => {
    renderList();
    for (const text of [
      "LAX-BID-INV-01hx3",
      "Invoice · Bid",
      "Credit note · lax.art",
      "£150.00",
      "Refused",
      "Locked period",
      "A line carries VAT, but Books has no VAT rate set up for it.",
    ]) {
      expect(screen.getAllByText(text).length).toBeGreaterThan(0);
    }
  });

  it("counts the tabs that have work waiting", () => {
    renderList();
    const tabs = screen.getByRole("navigation", { name: /views/i });
    expect(within(tabs).getByRole("link", { name: /Needs a person/ })).toHaveTextContent("4");
    expect(within(tabs).getByRole("link", { name: /Failed/ })).toHaveTextContent("2");
    expect(within(tabs).getByRole("link", { name: /Issued/ })).not.toHaveTextContent(/\d/);
  });

  it("tries a document again after a confirm that names the same reference", async () => {
    tryAgain.mockResolvedValue({
      ok: true,
      data: { id: rows[0]?.id, reference: "LAX-BID-INV-01hx3", outcome: "requeued" },
    });
    renderList();
    const menu = await openActions("LAX-BID-INV-01hx3");
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Try again" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Try LAX-BID-INV-01hx3 again?")).toBeInTheDocument();
    expect(within(dialog).getByText(/No new document is made/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(tryAgain).toHaveBeenCalledTimes(1));
    expect(tryAgain.mock.calls[0]?.[0]).toMatchObject({ documentId: rows[0]?.id });
    expect(tryAgain.mock.calls[0]?.[0].idempotencyKey).toEqual(expect.any(String));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("asks for confirmation of today's date before trying a locked period again", async () => {
    renderList();
    const menu = await openActions("LAX-ART-CN-7");
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Try again" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/today's date/)).toBeInTheDocument();
  });

  it("keeps the dialog open with the reason when the try again is refused", async () => {
    tryAgain.mockResolvedValue({ ok: false, error: "This document cannot be tried again now." });
    renderList();
    const menu = await openActions("LAX-BID-INV-01hx3");
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Try again" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Try again" }));
    expect(
      await within(dialog).findByText("This document cannot be tried again now."),
    ).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("offers no try again to someone who may only look", async () => {
    renderList({ canAct: false });
    const menu = await openActions("LAX-BID-INV-01hx3");
    expect(within(menu).queryByRole("menuitem", { name: "Try again" })).not.toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Copy LAX reference" })).toBeInTheDocument();
  });

  it("links an issued document to Books", () => {
    renderList({
      tab: "issued",
      rows: toAccountingStaffRows([
        accountingRow({
          state: "issued",
          problem: null,
          canTryAgain: false,
          books: {
            number: "INV-000042",
            id: "4600000000123",
            url: "https://books.zoho.eu/app/1#/invoices/4600000000123",
          },
        }),
      ]),
    });
    expect(screen.getAllByRole("link", { name: /INV-000042 · 4600000000123/ })[0]).toHaveAttribute(
      "href",
      "https://books.zoho.eu/app/1#/invoices/4600000000123",
    );
  });

  it("says a rehearsal reaches no Books organisation", () => {
    renderList({ rehearsal: true });
    expect(screen.getByText("Rehearsal only")).toBeInTheDocument();
  });

  it("explains an empty tab as good news", () => {
    renderList({ tab: "needs_person", rows: [], pagination: null });
    expect(screen.getByText("Nothing needs a person")).toBeInTheDocument();
  });

  it("shows a filter by company as a chip", () => {
    renderList({
      rows: [],
      pagination: null,
      filtered: true,
      search: { organisation: "london_art_exchange" },
    });
    expect(screen.getByText("Company: London Art Exchange")).toBeInTheDocument();
  });

  it("shows a failure in place of the rows, with a way to try loading again", () => {
    renderList({
      rows: [],
      pagination: null,
      loadError: "We could not reach the accounting service.",
    });
    expect(screen.getByText("Accounting documents couldn't be loaded")).toBeInTheDocument();
    expect(screen.getByText("We could not reach the accounting service.")).toBeInTheDocument();
  });
});
