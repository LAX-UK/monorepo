import { describe, expect, it } from "vitest";
import {
  LEGAL_DOCUMENT_SETS,
  acceptedLegalDocumentsFor,
  formatLegalDocumentDate,
} from "./legal-documents.js";

describe("accepted legal documents", () => {
  it("uses London Auction Xchange's documents for Bid and for LAX Account", () => {
    expect(acceptedLegalDocumentsFor("bid").entity).toBe("london-auction-xchange");
    expect(acceptedLegalDocumentsFor("account")).toBe(acceptedLegalDocumentsFor("bid"));
  });

  it("uses London Art Exchange's documents for Shop and lax.art", () => {
    expect(acceptedLegalDocumentsFor("shop").entity).toBe("london-art-exchange");
    expect(acceptedLegalDocumentsFor("art")).toBe(acceptedLegalDocumentsFor("shop"));
  });

  it("gives every company a dated version of both documents", () => {
    for (const set of Object.values(LEGAL_DOCUMENT_SETS)) {
      for (const document of [set.terms, set.privacy]) {
        expect(document.version.length).toBeGreaterThan(0);
        expect(document.effectiveOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it("writes a policy date the way the pages show it", () => {
    expect(formatLegalDocumentDate("2026-06-17")).toBe("17 June 2026");
    expect(formatLegalDocumentDate("2026-04-21")).toBe("21 April 2026");
  });
});
