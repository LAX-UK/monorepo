import { describe, expect, it } from "vitest";
import { accountingRow } from "./accounting-queue.fixture";
import {
  ACCOUNTING_EMPTY_COPY,
  accountingBooksCell,
  accountingFilterChips,
  accountingHref,
  accountingRangeSummary,
  accountingStatePresentation,
  accountingTabs,
  activeAccountingTab,
  activeOrganisation,
  toAccountingStaffRows,
  tryAgainCopy,
  tryAgainToast,
} from "./accounting-queue.vm";

const counts = { needs_person: 3, failed: 0, waiting: 12, issued: 40 };

describe("Accounting URL state", () => {
  it("lands on Needs a person for both companies, and ignores what it does not know", () => {
    expect(activeAccountingTab({})).toBe("needs_person");
    expect(activeAccountingTab({ tab: "issued" })).toBe("issued");
    expect(activeAccountingTab({ tab: "cancelled" })).toBe("needs_person");
    expect(activeOrganisation({})).toBeNull();
    expect(activeOrganisation({ organisation: "london_art_exchange" })).toBe("london_art_exchange");
    expect(activeOrganisation({ organisation: "bid" })).toBeNull();
  });

  it("builds links that keep the filter and restart paging", () => {
    expect(
      accountingHref({ organisation: "london_art_exchange", offset: "50" }, { tab: "failed" }),
    ).toBe("/admin/finance/accounting?organisation=london_art_exchange&tab=failed");
    expect(accountingHref({ tab: "failed" }, { offset: 50 })).toBe(
      "/admin/finance/accounting?tab=failed&offset=50",
    );
  });

  it("offers the four tabs, counting only the ones with work waiting", () => {
    const tabs = accountingTabs({ organisation: "london_auction_xchange" }, counts);
    expect(tabs.map((tab) => [tab.id, tab.label, tab.count])).toEqual([
      ["needs_person", "Needs a person", 3],
      ["failed", "Failed", undefined],
      ["waiting", "Waiting", 12],
      ["issued", "Issued", undefined],
    ]);
    expect(tabs[0]?.href).toBe("/admin/finance/accounting?organisation=london_auction_xchange");
  });

  it("shows the company filter as a chip that clears it", () => {
    expect(accountingFilterChips({})).toEqual([]);
    expect(accountingFilterChips({ organisation: "london_art_exchange", tab: "failed" })).toEqual([
      {
        id: "organisation",
        label: "Company: London Art Exchange",
        clearHref: "/admin/finance/accounting?tab=failed",
      },
    ]);
  });
});

describe("Accounting rows", () => {
  it("words a row for staff", () => {
    const [row] = toAccountingStaffRows([accountingRow()]);
    expect(row).toMatchObject({
      reference: "LAX-BID-INV-01hx3",
      kind: "Invoice · Bid",
      company: "London Auction Xchange",
      amount: "£150.00",
      attempts: 2,
      state: { label: "Refused", tone: "danger" },
      problem: "A line carries VAT, but Books has no VAT rate set up for it.",
      books: { kind: "none" },
      canTryAgain: true,
      rehearsal: false,
    });
  });

  it("marks a locked period, a rehearsal and each stage with a badge that reads without colour", () => {
    expect(accountingStatePresentation(accountingRow({ lockedPeriod: true }))).toEqual({
      label: "Locked period",
      tone: "warning",
    });
    expect(
      accountingStatePresentation(accountingRow({ state: "issued", targetMode: "dry_run" })),
    ).toEqual({ label: "Rehearsed", tone: "neutral" });
    expect(accountingStatePresentation(accountingRow({ state: "needs_review" })).label).toBe(
      "Needs a person",
    );
    expect(accountingStatePresentation(accountingRow({ state: "unknown" })).label).toBe(
      "Checking Books",
    );
    expect(accountingStatePresentation(accountingRow({ state: "issued" })).label).toBe("In Books");
  });

  it("links an issued document to Books, and never a rehearsal", () => {
    const books = { number: "INV-000042", id: "4600000000123", url: "https://books.zoho.eu/x" };
    expect(accountingBooksCell(accountingRow({ books }))).toEqual({
      kind: "link",
      label: "INV-000042 · 4600000000123",
      href: "https://books.zoho.eu/x",
    });
    expect(accountingBooksCell(accountingRow({ books: { ...books, url: null } }))).toEqual({
      kind: "text",
      label: "INV-000042 · 4600000000123",
    });
    expect(
      accountingBooksCell(
        accountingRow({
          targetMode: "dry_run",
          books: { number: "DRY-RUN", id: "dry-run:x", url: null },
        }),
      ),
    ).toEqual({ kind: "text", label: "Rehearsal, not in Books" });
  });
});

describe("Try again", () => {
  it("says the same document goes again under the same reference", () => {
    const copy = tryAgainCopy({ reference: "LAX-BID-INV-01hx3", lockedPeriod: false });
    expect(copy.title).toBe("Try LAX-BID-INV-01hx3 again?");
    expect(copy.description).toContain("same LAX reference LAX-BID-INV-01hx3");
    expect(copy.description).toContain("No new document is made.");
    expect(copy.confirmLabel).toBe("Try again");
  });

  it("asks a person to confirm booking on today's date first for a locked period", () => {
    const copy = tryAgainCopy({ reference: "LAX-BID-INV-01hx3", lockedPeriod: true });
    expect(copy.description).toContain("today's date");
    expect(copy.description).toContain("Only try again once that is confirmed.");
  });

  it("tells the person what happened", () => {
    expect(tryAgainToast("requeued", "LAX-1")).toBe("LAX-1 is queued to send again");
    expect(tryAgainToast("already_queued", "LAX-1")).toBe("LAX-1 was already queued");
  });
});

describe("Empty and long lists", () => {
  it("has plain, sentence-case copy for every empty tab", () => {
    for (const copy of Object.values(ACCOUNTING_EMPTY_COPY)) {
      expect(copy.title).toMatch(/^[A-Z][a-z]/);
      expect(copy.title).not.toMatch(/ [A-Z][a-z]+ [A-Z]/);
    }
  });

  it("summarises a page of a long list", () => {
    expect(accountingRangeSummary(0, 50, 1_312)).toBe("1–50 of 1,312 documents");
    expect(accountingRangeSummary(0, 1, 1)).toBe("1–1 of 1 document");
  });
});
