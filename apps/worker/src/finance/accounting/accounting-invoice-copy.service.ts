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
  IShopInvoiceEmailFactsReader,
  InvoiceEmailDue,
  InvoiceEmailSkipReason,
  StoredAccountingDocument,
} from "@auction/persistence/interfaces";
import { composeBidInvoiceEmail } from "./bid-invoice-email.js";
import { composeShopInvoiceEmail } from "./shop-invoice-email.js";

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
  /** The Shop order behind a Shop invoice, and who owns it now. */
  readonly shopEmailFacts: IShopInvoiceEmailFactsReader;
  /** The email outbox (Postmark); only ever given an invoice Books issued for real. */
  readonly email: Pick<IEmailService, "enqueue">;
  /** The Bid site's address, for the link to the purchase. */
  readonly webBaseUrl: string;
  /** The Shop storefront's address, for the link to the order. */
  readonly shopStorefrontUrl: string;
  readonly now: () => Date;
  readonly log: AccountingInvoiceCopyLog;
  readonly batch?: number;
}

export interface CopyTick {
  readonly stored: number;
  readonly emailed: number;
}

/**
 * After the sender: keeps LAX's own copy of each issued Bid and Shop invoice's PDF, then emails
 * the buyer their invoice with that copy attached, once.
 *
 * - The PDF is fetched through the same adapter the document was sent with (in dry run, a page
 *   that says it is a rehearsal), stored in document storage, and recorded. A fetch that fails is
 *   tried again next tick; nothing is recorded until the file is stored.
 * - The email goes only for an invoice Books issued `live`: never a rehearsal, and never a test
 *   organisation's invoice, which is not a tax invoice (this service and the query each refuse
 *   both; the table refuses to record a rehearsal as emailed). Each message has an idempotency key
 *   per document, so the outbox holds one however often this runs.
 * - Every listed copy is settled, so none holds a place at the head of the list: it is queued, or
 *   skipped for good (cancelled, nobody to send it to, unreadable) with a warning. Only an error
 *   leaves it due, to try again next tick.
 * - Bid: it goes to the payer while they may still pay (an organisation's current member with a
 *   payer role) and to the account's billing inbox; a former member gets nothing.
 * - Shop: it goes to the order's owner now (the guest, or the account that claimed the order),
 *   while they can be reached; an erased guest or a closed account gets nothing.
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
    // A rehearsal or a test organisation emails no one: only an invoice Books issued live is.
    const emailed = modes.includes("live") ? await this.sendEmails() : 0;
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
    const { due, unreadable } = await this.deps.copies.listEmailDue(this.batch);
    for (const documentId of unreadable) {
      await this.skip(documentId, "unreadable_document");
    }
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

  /** Settles a copy's email as never to be sent, so it leaves the due list; says why. */
  private async skip(documentId: string, reason: InvoiceEmailSkipReason): Promise<void> {
    try {
      await this.deps.copies.markEmailSkipped(documentId, reason, this.deps.now());
      this.deps.log.warn({ documentId, reason }, "accounting_invoice_email_skipped");
    } catch (error) {
      this.deps.log.warn(
        { documentId, reason, err: error instanceof Error ? error.name : "unknown" },
        "accounting_invoice_email_failed",
      );
    }
  }

  private async sendEmail(copy: InvoiceEmailDue): Promise<boolean> {
    return copy.product === "shop" ? this.sendShopEmail(copy) : this.sendBidEmail(copy);
  }

  private async sendShopEmail(copy: InvoiceEmailDue): Promise<boolean> {
    const facts = await this.deps.shopEmailFacts.forOrder(copy.invoiceId);
    if (!facts) {
      await this.skip(copy.documentId, "invoice_missing");
      return false;
    }
    if (facts.cancelled) {
      await this.skip(copy.documentId, "invoice_cancelled");
      return false;
    }
    if (!facts.recipient) {
      await this.skip(copy.documentId, "no_recipient");
      return false;
    }
    const now = this.deps.now();
    const queued = await this.deps.email.enqueue({
      template: "shop-invoice-issued",
      to: facts.recipient.email,
      recipientResolution: "snapshot",
      category: "transactional",
      idempotencyKey: `shop-invoice-issued:${copy.documentId}`,
      vars: composeShopInvoiceEmail({
        number: copy.number,
        facts,
        storageKey: copy.storageKey,
        storefrontUrl: this.deps.shopStorefrontUrl,
        now,
      }),
    });
    await this.deps.copies.markEmailQueued(copy.documentId, queued.outboxId, now);
    this.deps.log.info(
      { documentId: copy.documentId, product: "shop" },
      "accounting_invoice_email_queued",
    );
    return true;
  }

  private async sendBidEmail(copy: InvoiceEmailDue): Promise<boolean> {
    const facts = await this.deps.emailFacts.forInvoice(copy.invoiceId);
    if (!facts) {
      await this.skip(copy.documentId, "invoice_missing");
      return false;
    }
    if (facts.cancelled) {
      await this.skip(copy.documentId, "invoice_cancelled");
      return false;
    }
    const payer = facts.payer;
    // The finance team's billing inbox gets its own copy, unless it is the payer's own address.
    const billing =
      facts.billingEmail &&
      (!payer || facts.billingEmail.toLowerCase() !== payer.email.toLowerCase())
        ? facts.billingEmail
        : null;
    if (!payer && !billing) {
      await this.skip(copy.documentId, "no_recipient");
      return false;
    }
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
    let outboxId: string | null = null;
    if (payer) {
      const queued = await this.deps.email.enqueue({
        template: "bid-invoice-issued",
        to: payer.email,
        userId: payer.userId,
        category: "transactional",
        idempotencyKey: `bid-invoice-issued:${copy.documentId}`,
        vars: compose(payer.name),
      });
      outboxId = queued.outboxId;
    }
    if (billing) {
      const queued = await this.deps.email.enqueue({
        template: "bid-invoice-issued",
        to: billing,
        recipientResolution: "snapshot",
        category: "transactional",
        idempotencyKey: `bid-invoice-issued-billing:${facts.buyerLegalEntityId}:${copy.documentId}`,
        vars: compose(null),
      });
      outboxId ??= queued.outboxId;
    }
    if (outboxId === null) return false;
    await this.deps.copies.markEmailQueued(copy.documentId, outboxId, now);
    this.deps.log.info(
      { documentId: copy.documentId, toPayer: payer !== null, toBilling: billing !== null },
      "accounting_invoice_email_queued",
    );
    return true;
  }
}
