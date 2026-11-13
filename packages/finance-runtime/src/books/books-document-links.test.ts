import { BID_ORG_ID, SHOP_ORG_ID, rawOrgSettings } from "@auction/accounting-zoho-books/testing";
import { describe, expect, it } from "vitest";
import type { BooksDocumentLink } from "../interfaces/accounting-queue.js";
import { createBooksDocumentLinks } from "./books-document-links.js";

type LinkInput = Parameters<BooksDocumentLink>[0];

const config = JSON.stringify(rawOrgSettings());
/** A Books-shaped id, so only the rule under test can refuse the link. */
const BOOKS_ID = "4600000000123";
const input = (overrides: Partial<LinkInput> = {}): LinkInput => ({
  organisation: "london_auction_xchange",
  documentType: "invoice",
  targetMode: "live",
  booksId: BOOKS_ID,
  ...overrides,
});

describe("createBooksDocumentLinks", () => {
  const links = createBooksDocumentLinks({ ZOHO_BOOKS_ORG_CONFIG: config });

  it("links a live or test document to its own organisation and document type in Books", () => {
    expect(links(input())).toBe(`https://books.zoho.eu/app/${BID_ORG_ID}#/invoices/${BOOKS_ID}`);
    expect(
      links(
        input({
          organisation: "london_art_exchange",
          documentType: "credit_note",
          targetMode: "test_org",
        }),
      ),
    ).toBe(`https://books.zoho.eu/app/${SHOP_ORG_ID}#/creditnotes/${BOOKS_ID}`);
    for (const [documentType, path] of [
      ["payment", "paymentsreceived"],
      ["bill", "bills"],
      ["contact", "contacts"],
    ] as const) {
      expect(links(input({ documentType }))).toBe(
        `https://books.zoho.eu/app/${BID_ORG_ID}#/${path}/${BOOKS_ID}`,
      );
    }
  });

  it("gives no link for a rehearsal, even when its id looks like one Books made", () => {
    expect(links(input({ targetMode: "dry_run" }))).toBeNull();
    expect(links(input({ targetMode: "dry_run", booksId: "dry-run:x" }))).toBeNull();
  });

  it("gives no link for a document with no target", () => {
    expect(links(input({ targetMode: null }))).toBeNull();
  });

  it("gives no link for a company with no organisation in the settings", () => {
    const shopOnly = createBooksDocumentLinks({
      ZOHO_BOOKS_ORG_CONFIG: JSON.stringify(rawOrgSettings({ withoutBid: true })),
    });
    expect(shopOnly(input({ organisation: "london_auction_xchange" }))).toBeNull();
    expect(shopOnly(input({ organisation: "london_art_exchange" }))).toBe(
      `https://books.zoho.eu/app/${SHOP_ORG_ID}#/invoices/${BOOKS_ID}`,
    );
  });

  it("gives no link for an id Books would not have made", () => {
    for (const booksId of ["", "INV-1", "12/../34", "1".repeat(33)]) {
      expect(links(input({ booksId })), booksId).toBeNull();
    }
  });

  it("gives no links when the settings are missing, blank, not JSON or not valid settings", () => {
    for (const ZOHO_BOOKS_ORG_CONFIG of [undefined, "", "   ", "not json", '{"bid":1}']) {
      const none = createBooksDocumentLinks({ ZOHO_BOOKS_ORG_CONFIG });
      expect(none(input()), String(ZOHO_BOOKS_ORG_CONFIG)).toBeNull();
    }
  });
});
