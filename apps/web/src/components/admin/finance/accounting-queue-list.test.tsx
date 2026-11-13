import { accountingRow } from "@/lib/admin/finance/accounting-queue.fixture";
import { toAccountingStaffRows } from "@/lib/admin/finance/accounting-queue.vm";
import { StaffTooltipProvider } from "@auction/staff-ui";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountingQueueList, type AccountingQueueListProps } from "./accounting-queue-list";

const { tryAgain, refresh, navigate } = vi.hoisted(() => ({
  tryAgain: vi.fn(),
  refresh: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin/finance/accounting",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/actions/admin/admin-accounting", () => ({
  tryAgainAccountingDocumentAction: tryAgain,
}));
vi.mock("@/components/admin/staff/use-staff-list-navigation", () => ({
  useStaffListNavigation: () => ({
    pending: false,
    navigate,
    Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
      <a href={href} {...rest}>
        {children}
      </a>
    ),
  }),
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
    issuedToday: 0,
    lastSent: null,
    organisation: null,
    reference: "",
    referenceError: null,
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
    navigate.mockReset();
  });

  it("lists each document with its reference, type, company, amount and problem", () => {
    renderList();
    for (const text of [
      "LAX-BID-INV-01hx3",
      "Invoice · Bid",
      "Credit note · lax.art",
      "£150.00",
      "Failed",
      "Locked period",
      "A line carries VAT, but Books has no VAT rate set up for it.",
    ]) {
      expect(screen.getAllByText(text).length).toBeGreaterThan(0);
    }
  });

  it("counts the waiting tabs, and the Issued tab by today's total", () => {
    renderList({ issuedToday: 5 });
    const tabs = screen.getByRole("navigation", { name: /views/i });
    expect(within(tabs).getByRole("link", { name: /Needs a person/ })).toHaveTextContent("4");
    expect(within(tabs).getByRole("link", { name: /Failed/ })).toHaveTextContent("2");
    expect(within(tabs).getByRole("link", { name: /Issued today/ })).toHaveTextContent("5");
  });

  it("leaves the Issued tab uncounted when nothing was issued today", () => {
    renderList({ issuedToday: 0 });
    const tabs = screen.getByRole("navigation", { name: /views/i });
    expect(within(tabs).getByRole("link", { name: /Issued/ })).not.toHaveTextContent(/\d/);
  });

  it("gives Last problem the table's spare room and keeps the phone's Tried line out of the table", () => {
    renderList();
    const table = screen.getByRole("grid", { name: "Accounting documents" });
    const headers = within(table)
      .getAllByRole("columnheader")
      .map((th) => th.textContent);
    expect(headers).toContain("Last problem");
    expect(headers).not.toContain("Tried");
    // The flexible column sets no width of its own; the table keeps room for it.
    const problem = within(table).getByRole("columnheader", { name: "Last problem" });
    expect(problem.style.width).toBe("");
    expect(table.style.getPropertyValue("--staff-table-min-lg")).not.toBe("");
  });

  it("on a phone, shows the whole reference, the status under it and the last problem", () => {
    renderList();
    const list = screen.getByRole("list", { name: "Accounting documents" });
    const [first] = within(list).getAllByRole("listitem");
    if (!first) throw new Error("no rows");
    // The reference wraps instead of being cut.
    expect(within(first).getByText("LAX-BID-INV-01hx3")).not.toHaveClass("truncate");
    expect(
      within(first).getByText("A line carries VAT, but Books has no VAT rate set up for it."),
    ).toHaveClass("line-clamp-2");
    expect(within(first).getByText("Failed")).toBeInTheDocument();
    expect(within(first).getByText(/Tried twice|Tried 2 times/)).toBeInTheDocument();
  });

  it("on a phone, lets the Tried line wrap beside Try again instead of cutting the time off", () => {
    renderList();
    const list = screen.getByRole("list", { name: "Accounting documents" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const meta = row.querySelector("[data-meta-line]");
      if (!meta) throw new Error("no meta line");
      // The kit's meta slot truncates; this line opts back into wrapping, whole time included.
      expect(meta).toHaveClass("whitespace-normal");
      expect(meta).not.toHaveClass("truncate");
      expect(meta.textContent).toMatch(/^Tried (once|\d+ times) · last .+\d{2}:\d{2}/);
    }
  });

  it("lets the company control take a full row on a phone so Display is not cut off", () => {
    renderList();
    expect(screen.getByRole("group", { name: "Company" })).toHaveClass("max-sm:w-full");
  });

  it("names the source and when it last reached Books", () => {
    renderList({
      lastSent: { at: "2026-11-11T09:00:00.000Z", rehearsal: false },
      organisation: "london_art_exchange",
    });
    expect(
      screen.getByText(/Zoho Books · London Art Exchange Ltd · last sent/),
    ).toBeInTheDocument();
  });

  it("says when the last document was only rehearsed", () => {
    renderList({ lastSent: { at: "2026-11-11T09:00:00.000Z", rehearsal: true } });
    expect(screen.getByText(/Rehearsal only · last rehearsed/)).toBeInTheDocument();
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

  it("offers each actionable row a visible Try again button", () => {
    renderList();
    // The failed row has a Try again button in its own cell, as well as in the … menu.
    expect(screen.getAllByRole("button", { name: "Try again" }).length).toBeGreaterThan(0);
  });

  it("explains a locked period above the list", () => {
    renderList({ tab: "needs_person" });
    expect(screen.getByText("1 document is dated in a locked period")).toBeInTheDocument();
  });

  it("requires an acknowledgement before trying a locked period again", async () => {
    renderList();
    const menu = await openActions("LAX-ART-CN-7");
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Try again" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/accountant has closed/)).toBeInTheDocument();
    const confirm = within(dialog).getByRole("button", { name: "Try again" });
    expect(confirm).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("checkbox"));
    expect(confirm).toBeEnabled();
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

  it("opens a details sheet with the whole problem when a row is opened", async () => {
    renderList();
    fireEvent.click(screen.getAllByText("LAX-BID-INV-01hx3")[0] as HTMLElement);
    const sheet = await screen.findByRole("dialog");
    expect(
      within(sheet).getByText("A line carries VAT, but Books has no VAT rate set up for it."),
    ).toBeInTheDocument();
    expect(within(sheet).getByText("LAX reference")).toBeInTheDocument();
  });

  it("links an issued document to Books by its Books number", () => {
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
    expect(screen.getAllByRole("link", { name: /INV-000042/ })[0]).toHaveAttribute(
      "href",
      "https://books.zoho.eu/app/1#/invoices/4600000000123",
    );
  });

  it("searches by LAX reference from the toolbar", () => {
    renderList();
    const search = screen.getByRole("searchbox", { name: /LAX reference/ });
    fireEvent.change(search, { target: { value: "LAX-BID-INV-9" } });
    fireEvent.submit(search.closest("form") as HTMLFormElement);
    expect(navigate).toHaveBeenCalledWith(expect.stringContaining("reference=LAX-BID-INV-9"));
  });

  it("warns when the search is not a LAX reference", () => {
    renderList({ referenceError: "Enter a LAX reference, e.g. LAX-BID-INV-….", rows: [] });
    expect(screen.getByText("That is not a LAX reference")).toBeInTheDocument();
  });

  it("says a rehearsal reaches no Books organisation", () => {
    renderList({ rehearsal: true });
    expect(screen.getByText("Rehearsal only")).toBeInTheDocument();
  });

  it("explains an empty tab as good news", () => {
    renderList({ tab: "needs_person", rows: [], pagination: null });
    expect(screen.getByText("Nothing needs a person")).toBeInTheDocument();
  });

  it("shows the company filter as a segmented control", () => {
    renderList({
      organisation: "london_art_exchange",
      search: { organisation: "london_art_exchange" },
    });
    const active = screen.getByRole("radio", { name: "Art Exchange" });
    expect(active).toHaveAttribute("data-state", "on");
    expect(screen.getByRole("radio", { name: "Both" })).toHaveAttribute("data-state", "off");
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
