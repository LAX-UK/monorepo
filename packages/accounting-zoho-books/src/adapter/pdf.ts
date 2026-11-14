import type { DocumentPdfPort, PdfOutcome } from "@auction/accounting-domain";
import { ZOHO_BOOKS_REJECTIONS } from "./rejections.js";

/**
 * The Books PDF of an issued invoice or credit note (`IssuedDocument.pdfRef`, read with
 * `?accept=pdf`). The Books client reads JSON only, so this answers `unavailable` with
 * `zoho_books_pdf_not_built` and fetches nothing; the stored copy is simply not made yet and the
 * buyer's invoice stays "being prepared". It is built with the test-organisation step, when the
 * transport can read bytes. Only the rehearsal adapter is wired at runtime in this phase.
 */
export class ZohoDocumentPdfGateway implements DocumentPdfPort {
  fetchPdf(): Promise<PdfOutcome> {
    return Promise.resolve({ status: "unavailable", reason: ZOHO_BOOKS_REJECTIONS.pdfNotBuilt });
  }
}
