import { describe, expect, it } from "vitest";
import { accountingRow } from "./accounting-queue.fixture";
import {
  ACCOUNTING_EMPTY_COPY,
  ORGANISATION_SEGMENTS,
  accountingBooksCell,
  accountingHref,
  accountingRangeSummary,
  accountingStatePresentation,
  accountingTabs,
  activeAccountingTab,
  activeOrganisation,
  activeReference,
  legalNameForOrganisation,
  legalNamesForFilter,
  lockedPeriodTitle,
  rowMetaLine,
  rowMetaParts,
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
    expect(activeReference({})).toBe("");
    expect(activeReference({ reference: "  LAX-BID-INV-1  " })).toBe("LAX-BID-INV-1");
  });

  it("builds links that keep the filter and restart paging", () => {
    expect(
      accountingHref({ organisation: "london_art_exchange", offset: "50" }, { tab: "failed" }),
    ).toBe("/admin/finance/accounting?organisation=london_art_exchange&tab=failed");
    expect(accountingHref({ tab: "failed" }, { offset: 50 })).toBe(
      "/admin/finance/accounting?tab=failed&offset=50",
    );
  });

  it("offers the four tabs, counting waiting work and the Issued tab by today's total", () => {
    const tabs = accountingTabs({ organisation: "london_auction_xchange" }, counts, 7);
    expect(tabs.map((tab) => [tab.id, tab.label, tab.count])).toEqual([
      ["needs_person", "Needs a person", 3],
      ["failed", "Failed", undefined],
      ["waiting", "Waiting", 12],
      ["issued", "Issued today", 7],
    ]);
    expect(tabs[0]?.href).toBe("/admin/finance/accounting?organisation=london_auction_xchange");
    // Nothing issued today leaves the Issued tab without a count.
    expect(accountingTabs({}, counts, 0)[3]?.count).toBeUndefined();
  });

  it("offers the three-way company filter as a segmented control, both first", () => {
    expect(ORGANISATION_SEGMENTS.map((s) => s.value)).toEqual([
      "",
      "london_auction_xchange",
      "london_art_exchange",
    ]);
  });
});

describe("Company names", () => {
  it("uses the filed company name with its legal suffix", () => {
    expect(legalNameForOrganisation("london_auction_xchange")).toBe("London Auction Xchange LTD");
    expect(legalNameForOrganisation("london_art_exchange")).toBe("London Art Exchange Ltd");
    expect(legalNamesForFilter(null)).toBe(
      "London Auction Xchange LTD and London Art Exchange Ltd",
    );
    expect(legalNamesForFilter("london_art_exchange")).toBe("London Art Exchange Ltd");
  });
});

describe("Accounting rows", () => {
  it("words a row for staff", () => {
    const [row] = toAccountingStaffRows([accountingRow()]);
    expect(row).toMatchObject({
      reference: "LAX-BID-INV-01hx3",
      kind: "Invoice · Bid",
      company: "London Auction Xchange LTD",
      amount: "£150.00",
      attempts: 2,
      state: { label: "Failed", tone: "danger" },
      problem: "A line carries VAT, but Books has no VAT rate set up for it.",
      books: { kind: "none" },
      canTryAgain: true,
      rehearsal: false,
    });
  });

  it("shows the phone row meta as tries and the last attempt", () => {
    expect(rowMetaLine({ attempts: 1, updatedAt: "2026-11-11T09:30:00Z" })).toMatch(
      /^Tried once · last /,
    );
    expect(rowMetaLine({ attempts: 3, updatedAt: "2026-11-11T09:30:00Z" })).toMatch(
      /^Tried 3 times · last /,
    );
  });

  it("splits the phone row meta at the dot, so it can wrap there and keep the time whole", () => {
    const [tries, last] = rowMetaParts({ attempts: 2, updatedAt: "2026-11-12T09:30:00Z" });
    expect(tries).toBe("Tried 2 times");
    expect(last).toMatch(/^last .*12 Nov.*\d{2}:\d{2}/);
    expect(rowMetaLine({ attempts: 2, updatedAt: "2026-11-12T09:30:00Z" })).toBe(
      `${tries} · ${last}`,
    );
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
    expect(accountingStatePresentation(accountingRow({ state: "failed" })).label).toBe("Failed");
    expect(accountingStatePresentation(accountingRow({ state: "issued" })).label).toBe("In Books");
  });

  it("links an issued document to Books by its Books number only, and never a rehearsal", () => {
    const books = { number: "INV-000042", id: "4600000000123", url: "https://books.zoho.eu/x" };
    expect(accountingBooksCell(accountingRow({ books }))).toEqual({
      kind: "link",
      label: "INV-000042",
      href: "https://books.zoho.eu/x",
    });
    expect(accountingBooksCell(accountingRow({ books: { ...books, url: null } }))).toEqual({
      kind: "text",
      label: "INV-000042",
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

  it("tells a person to have the accountant reopen the period first for a locked period", () => {
    const copy = tryAgainCopy({ reference: "LAX-BID-INV-01hx3", lockedPeriod: true });
    expect(copy.description).toContain("accountant has closed");
    expect(copy.description).toContain("reopen it");
  });

  it("heads the locked-period explanation with how many documents it covers", () => {
    expect(lockedPeriodTitle(1)).toBe("1 document is dated in a locked period");
    expect(lockedPeriodTitle(3)).toBe("3 documents are dated in a locked period");
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

describe("Accounting rows for payments", () => {
  it("names a Pay several payment, lists what it applies to and the order it is sent in", () => {
    const [row] = toAccountingStaffRows([
      accountingRow({
        reference: "LAX-BID-PAY-grp-0b6a7c1e",
        documentType: "payment",
        label: "Payment · Pay several",
        state: "pending",
        problem: null,
        appliedTo: [
          { reference: "LAX-BID-INV-a", amountPence: 3_333 },
          { reference: "LAX-BID-INV-b", amountPence: 6_667 },
        ],
      }),
    ]);
    expect(row).toMatchObject({
      kind: "Payment · Pay several",
      parked: null,
      appliedTo: [
        { reference: "LAX-BID-INV-a", amount: "£33.33" },
        { reference: "LAX-BID-INV-b", amount: "£66.67" },
      ],
      note: "Sent once each invoice it pays is in Books.",
    });
  });

  it("shows a parked delivery invoice as waiting for the accountant, with no try again", () => {
    const [row] = toAccountingStaffRows([
      accountingRow({
        reference: "LAX-BID-INV-dlv-0b6a7c1e",
        label: "Delivery invoice · Pay several",
        state: "needs_review",
        parked: "vat_on_delivery",
        canTryAgain: false,
        problem:
          "Waiting for the accountant: VAT on delivery. This stays out of Books until they confirm how delivery is booked.",
      }),
    ]);
    expect(row?.state).toEqual({ label: "Waiting for the accountant", tone: "warning" });
    expect(row).toMatchObject({
      kind: "Delivery invoice · Pay several",
      canTryAgain: false,
      note: null,
    });
    expect(
      accountingStatePresentation({
        state: "needs_review",
        lockedPeriod: false,
        targetMode: "dry_run",
        parked: "invoice_cancelled",
      }),
    ).toEqual({ label: "Needs a person", tone: "warning" });
  });
});
