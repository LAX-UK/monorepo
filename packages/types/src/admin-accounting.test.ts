import { describe, expect, it } from "vitest";
import {
  ACCOUNTING_LOCKED_PERIOD_TEXT,
  accountingProblemCode,
  accountingProblemText,
  isAccountingOrganisation,
  isAccountingQueueTab,
} from "./admin-accounting.js";

describe("accounting problems in plain English", () => {
  it("words the adapter's own refusals", () => {
    expect(accountingProblemText("zoho_books_mapping_no_tax_id")).toBe(
      "A line carries VAT, but Books has no VAT rate set up for it.",
    );
    expect(accountingProblemText("zoho_books_organisation_not_configured")).toBe(
      "This company's Books organisation is not set up yet.",
    );
  });

  it("words a client error by its kind, and never shows an unknown code raw", () => {
    expect(accountingProblemText("zoho_books_auth_reauth_required")).toBe(
      "Books would not accept our sign-in.",
    );
    expect(accountingProblemText("zoho_books_budget_exhausted_daily_budget_spent")).toBe(
      "Today's Books call allowance is used up.",
    );
    expect(accountingProblemText("zoho_books_validation_http_418")).toBe(
      "Books refused the document.",
    );
    expect(accountingProblemText("something_new")).toBe("Books refused the document.");
  });

  it("explains a locked period, however it was reported", () => {
    expect(accountingProblemText("zoho_books_validation_period_locked")).toBe(
      ACCOUNTING_LOCKED_PERIOD_TEXT,
    );
    expect(accountingProblemText("refused 8 times: fake_period_locked")).toBe(
      `Refused 8 times. ${ACCOUNTING_LOCKED_PERIOD_TEXT}`,
    );
    expect(ACCOUNTING_LOCKED_PERIOD_TEXT).toContain("today's date");
  });

  it("words the life cycle's own reasons", () => {
    expect(accountingProblemText("provider total differs: grossPence by -2 pence")).toBe(
      "Books worked out a gross total 2p different from ours. It is in Books; check it there.",
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
