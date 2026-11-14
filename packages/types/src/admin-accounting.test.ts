import { describe, expect, it } from "vitest";
import {
  ACCOUNTING_LOCKED_PERIOD_PROBLEM,
  ACCOUNTING_LOCKED_PERIOD_TEXT,
  accountingProblemCode,
  accountingProblemText,
  accountingTotalsMismatchText,
  isAccountingOrganisation,
  isAccountingQueueTab,
} from "./admin-accounting.js";

describe("accounting problems in plain English", () => {
  it("says a parked outside-UK delivery waits for the accountant and is not sent", () => {
    expect(accountingProblemText("accounting_parked_vat_on_outside_uk_delivery")).toBe(
      "Waiting for the accountant: VAT on outside-UK delivery. This stays out of Books until they confirm how it is booked.",
    );
  });

  it("words the adapter's own refusals", () => {
    expect(accountingProblemText("zoho_books_mapping_no_tax_id")).toBe(
      "A line carries VAT, but Books has no VAT rate set up for it.",
    );
    expect(accountingProblemText("zoho_books_organisation_not_configured")).toBe(
      "This company's Books organisation is not set up yet.",
    );
  });

  it("words a client error by its kind, ending with the next step, never a raw code", () => {
    expect(accountingProblemText("zoho_books_auth_reauth_required")).toBe(
      "Books would not accept our sign-in. Ask engineering to reconnect Books.",
    );
    expect(accountingProblemText("zoho_books_budget_exhausted_daily_budget_spent")).toBe(
      "Today's Books call allowance is used up. It sends again once the allowance resets; you can also try now.",
    );
    expect(accountingProblemText("zoho_books_network_timeout")).toBe(
      "Books could not be reached. We'll keep trying; you can also try now.",
    );
    expect(accountingProblemText("zoho_books_validation_http_418")).toBe(
      "Books refused the document.",
    );
    expect(accountingProblemText("something_new")).toBe("Books refused the document.");
  });

  it("explains a locked period in the accountant's terms, however it was reported", () => {
    expect(accountingProblemText("zoho_books_validation_period_locked")).toBe(
      ACCOUNTING_LOCKED_PERIOD_PROBLEM,
    );
    expect(accountingProblemText("refused 8 times: fake_period_locked")).toBe(
      `Refused 8 times. ${ACCOUNTING_LOCKED_PERIOD_PROBLEM}`,
    );
    expect(ACCOUNTING_LOCKED_PERIOD_PROBLEM).toBe(
      "This falls in a period your accountant has closed.",
    );
    expect(ACCOUNTING_LOCKED_PERIOD_TEXT).toContain("reopen it");
  });

  it("says what Books worked out when its totals differ", () => {
    expect(accountingTotalsMismatchText("grossPence", 150_001)).toBe(
      "Books worked out £1,500.01. The totals must match before it can be issued.",
    );
    expect(accountingTotalsMismatchText("vatPence", 1)).toBe(
      "Books worked out £0.01 VAT. The totals must match before it can be issued.",
    );
    expect(accountingTotalsMismatchText("netPence", 149_999)).toBe(
      "Books worked out £1,499.99 net. The totals must match before it can be issued.",
    );
  });

  it("words the life cycle's own reasons", () => {
    expect(accountingProblemText("provider total differs: grossPence by -2 pence")).toBe(
      "Books worked out a gross total 2p different from ours. The totals must match before it can be issued.",
    );
    expect(
      accountingProblemText("no answer after 8 attempts; look it up before anything else"),
    ).toContain("Check Books for this reference");
    expect(accountingProblemText("2 documents carry this reference")).toContain("2 documents");
    expect(
      accountingProblemText("provider document differs from ours: zoho_books_payment_mismatch"),
    ).toContain("payment under this reference");
  });

  it("finds the provider code behind a reason", () => {
    expect(accountingProblemCode("refused 3 times: zoho_books_mapping_no_tax_id")).toBe(
      "zoho_books_mapping_no_tax_id",
    );
    expect(accountingProblemCode("2 documents carry this reference")).toBeNull();
  });

  it("knows its tabs and companies", () => {
    expect(isAccountingQueueTab("needs_person")).toBe(true);
    expect(isAccountingQueueTab("cancelled")).toBe(false);
    expect(isAccountingOrganisation("london_art_exchange")).toBe(true);
    expect(isAccountingOrganisation("bid")).toBe(false);
  });
});
