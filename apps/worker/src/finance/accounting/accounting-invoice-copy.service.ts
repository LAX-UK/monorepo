import { createHash } from "node:crypto";
import {
  type DocumentPdfPort,
  type PdfOutcome,
  type TargetMode,
  booksTargetMode,
} from "@auction/accounting-domain";
import type { IEmailService } from "@auction/email";
import type {
  IAccountingDocumentCopies,
  IAccountingSourceSettingReader,
  IBidInvoiceEmailFactsReader,
  InvoiceEmailDue,
  StoredAccountingDocument,
} from "@auction/persistence/interfaces";
import { composeBidInvoiceEmail } from "./bid-invoice-email.js";

const DEFAULT_BATCH = 10;

/** Where LAX keeps its copy of a document's PDF: by company and document id, never by a name. */
export function accountingCopyKey(document: Pick<StoredAccountingDocument, "id" | "legalEntity">) {
  return `accounting/${document.legalEntity}/${document.id}.pdf`;
}

export interface AccountingInvoiceCopyLog {
  info(details: Record<string, unknown>, message: string): void;
  warn(details: Record<string, unknown>, message: string): void;
}

export interface AccountingInvoiceCopyDeps {
  readonly copies: IAccountingDocumentCopies;
  readonly settings: IAccountingSourceSettingReader;
  /** The PDF port of each mode the sender serves (the same adapters it sends through). */
  readonly pdfsByMode: Readonly<Partial<Record<TargetMode, DocumentPdfPort>>>;
  readonly storage: {
    putObject(key: string, body: Buffer, contentType: string): Promise<unknown>;
  };
  readonly emailFacts: IBidInvoiceEmailFactsReader;
  /** The email outbox (Postmark); only ever given an invoice Books issued for real. */
  readonly email: Pick<IEmailService, "enqueue">;
  /** The Bid site's address, for the link to the purchase. */
  readonly webBaseUrl: string;
  readonly now: () => Date;
  readonly log: AccountingInvoiceCopyLog;
  readonly batch?: number;
}

export interface CopyTick {
  readonly stored: number;
  readonly emailed: number;
}

/**
 * After the sender: keeps LAX's own copy of each issued Bid invoice's PDF, then emails the buyer
 * their invoice with that copy attached, once.
 *
 * - The PDF is fetched through the same adapter the document was sent with (in dry run, a page
 *   that says it is a rehearsal), stored in document storage, and recorded. A fetch that fails is
 *   tried again next tick; nothing is recorded until the file is stored.
 * - The email goes only for an invoice Books issued in `test_org` or `live`, never a rehearsal
 *   (the query, this service and a table constraint each refuse it), with an idempotency key per
 *   document, so the outbox holds one message however often this runs.
 */
export class AccountingInvoiceCopy {
  private readonly batch: number;

  constructor(private readonly deps: AccountingInvoiceCopyDeps) {
    this.batch = deps.batch ?? DEFAULT_BATCH;
  }

  async tick(): Promise<CopyTick> {
    const modes = await this.activeModes();
    if (modes.length === 0) return { stored: 0, emailed: 0 };
    const stored = await this.storeCopies(modes);
    // A rehearsal emails no one: only an invoice issued in a writing mode is ever listed.
    const emailed = modes.some((mode) => mode !== "dry_run") ? await this.sendEmails() : 0;
    return { stored, emailed };
  }

  /** The modes Books is aimed at now that this worker has adapters for. */
  private async activeModes(): Promise<TargetMode[]> {
    const config = await this.deps.settings.read();
    if (!config.ok) return [];
    const aimed = new Set(
      Object.values(config.value)
        .map((product) => booksTargetMode(product))
        .filter((mode): mode is TargetMode => mode !== null),
    );
    return (Object.keys(this.deps.pdfsByMode) as TargetMode[]).filter((mode) => aimed.has(mode));
  }

  private async storeCopies(modes: readonly TargetMode[]): Promise<number> {
    const uncopied = await this.deps.copies.listUncopied(modes, this.batch);
    for (const id of uncopied.unreadable) {
      this.deps.log.warn({ documentId: id }, "accounting_copy_unreadable_document");
    }
    let stored = 0;
    for (const document of uncopied.documents) {
      if (await this.storeCopy(document)) stored += 1;
    }
    return stored;
  }

  private async storeCopy(document: StoredAccountingDocument): Promise<boolean> {
    const { record } = document;
    const mode = document.target?.mode;
    const port = mode ? this.deps.pdfsByMode[mode] : undefined;
    if (record.status !== "issued" || !mode || !port) return false;
    let pdf: PdfOutcome;
    try {
      pdf = await port.fetchPdf(document.document, record.issued);
    } catch (error) {
      pdf = { status: "unavailable", reason: error instanceof Error ? error.name : "unknown" };
    }
    if (pdf.status !== "fetched") {
      this.deps.log.warn(
        { documentId: document.id, mode, reason: pdf.reason },
        "accounting_copy_unavailable",
      );
      return false;
    }
    // A stand-in page is never kept as a provider's document for a test or live invoice.
    if (pdf.rehearsal && mode !== "dry_run") {
      this.deps.log.warn({ documentId: document.id, mode }, "accounting_copy_rehearsal_refused");
      return false;
    }
    const body = Buffer.from(pdf.bytes);
    const key = accountingCopyKey(document);
    await this.deps.storage.putObject(key, body, pdf.contentType);
    const created = await this.deps.copies.record({
      documentId: document.id,
      storageKey: key,
      byteSize: body.length,
      sha256: createHash("sha256").update(body).digest("hex"),
      rehearsal: pdf.rehearsal || mode === "dry_run",
      storedAt: this.deps.now(),
    });
    this.deps.log.info({ documentId: document.id, mode, created }, "accounting_copy_stored");
    return created;
  }

  private async sendEmails(): Promise<number> {
    const due = await this.deps.copies.listEmailDue(this.batch);
    let emailed = 0;
    for (const copy of due) {
      try {
        if (await this.sendEmail(copy)) emailed += 1;
      } catch (error) {
        // Tried again next tick; the idempotency key keeps it to one message.
        this.deps.log.warn(
          { documentId: copy.documentId, err: error instanceof Error ? error.name : "unknown" },
          "accounting_invoice_email_failed",
        );
      }
    }
    return emailed;
  }

  private async sendEmail(copy: InvoiceEmailDue): Promise<boolean> {
    const facts = await this.deps.emailFacts.forInvoice(copy.invoiceId);
    if (!facts?.payer || facts.cancelled) return false;
    const now = this.deps.now();
    const base = this.deps.webBaseUrl.replace(/\/$/, "");
    const lotUrl = `${base}/purchases/${encodeURIComponent(facts.lotId)}`;
    const compose = (userName: string | null) =>
      composeBidInvoiceEmail({
        number: copy.number,
        facts,
        storageKey: copy.storageKey,
        purchaseUrl: lotUrl,
        userName,
        now,
      });
    const queued = await this.deps.email.enqueue({
      template: "bid-invoice-issued",
      to: facts.payer.email,
      userId: facts.payer.userId,
      category: "transactional",
      idempotencyKey: `bid-invoice-issued:${copy.documentId}`,
      vars: compose(facts.payer.name),
    });
    // The finance team's billing inbox gets its own copy, unless it is the payer's own address.
    const billing = facts.billingEmail;
    if (billing && billing.toLowerCase() !== facts.payer.email.toLowerCase()) {
      await this.deps.email.enqueue({
        template: "bid-invoice-issued",
        to: billing,
        recipientResolution: "snapshot",
        category: "transactional",
        idempotencyKey: `bid-invoice-issued-billing:${facts.buyerLegalEntityId}:${copy.documentId}`,
        vars: compose(null),
      });
    }
    await this.deps.copies.markEmailQueued(copy.documentId, queued.outboxId, now);
    this.deps.log.info({ documentId: copy.documentId }, "accounting_invoice_email_queued");
    return true;
  }
}
