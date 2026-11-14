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
  InvoiceEmailProduct,
  InvoiceEmailSkipReason,
  StoredAccountingDocument,
} from "@auction/persistence/interfaces";
import { ACCOUNTING_ALERTS, type AccountingAlertSink } from "./accounting-alerts.js";
import { composeBidInvoiceEmail } from "./bid-invoice-email.js";
import { composeShopInvoiceEmail, shopStorefrontBase } from "./shop-invoice-email.js";

const DEFAULT_BATCH = 10;

/** The source id of a Shop outside-UK delivery invoice (`<order>-delivery`), not an order's. */
const DELIVERY_SOURCE = /-delivery$/;

/** Where LAX keeps its copy of a document's PDF: by company and document id, never by a name. */
export function accountingCopyKey(document: Pick<StoredAccountingDocument, "id" | "legalEntity">) {
  return `accounting/${document.legalEntity}/${document.id}.pdf`;
}

export interface AccountingInvoiceCopyLog {
  info(details: Record<string, unknown>, message: string): void;
  warn(details: Record<string, unknown>, message: string): void;
  error(details: Record<string, unknown>, message: string): void;
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
  /**
   * The Shop storefront's address, for the link to the order. No default: while it is unset or
   * local, no Shop invoice email is sent (each stays due) and every tick says why.
   */
  readonly shopStorefrontUrl: string | undefined;
  readonly now: () => Date;
  readonly log: AccountingInvoiceCopyLog;
  /**
   * Where `accounting_shop_invoice_email_refused` is raised (Sentry, which pages): Shop invoices
   * issued live are waiting and no buyer can be emailed. Without it the refusal is only logged.
   */
  readonly alerts?: AccountingAlertSink;
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
 *   while they can be reached; an erased guest or a closed account gets nothing. A merged account
 *   gets nothing either: nothing in LAX follows a merge to the surviving account yet. A refunded
 *   order's invoice still goes (a refund is credited, it does not cancel the invoice). The email's
 *   total is the attached invoice's. While SHOP_STOREFRONT_URL is unset or local, no Shop email
 *   is sent at all.
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
    // The Shop's emails are built only with a storefront address a buyer can open. Without one
    // the Shop is left out of this tick's list: its copies stay due (never settled), and they can
    // never fill the batch ahead of Bid's.
    const shopBase = this.shopBase();
    const products: InvoiceEmailProduct[] = shopBase === null ? ["bid"] : ["bid", "shop"];
    const { due, unreadable } = await this.deps.copies.listEmailDue(this.batch, products);
    for (const documentId of unreadable) {
      await this.skip(documentId, "unreadable_document");
    }
    let emailed = 0;
    for (const copy of due) {
      try {
        if (copy.product === "shop") {
          if (shopBase !== null && (await this.sendShopEmail(copy, shopBase))) emailed += 1;
          continue;
        }
        if (await this.sendBidEmail(copy)) emailed += 1;
      } catch (error) {
        // Tried again next tick; the idempotency key keeps it to one message.
        this.deps.log.warn(
          { documentId: copy.documentId, err: error instanceof Error ? error.name : "unknown" },
          "accounting_invoice_email_failed",
        );
      }
    }
    if (shopBase === null) await this.refuseShopEmails();
    return emailed;
  }

  /**
   * No storefront address: if Shop invoices are waiting for their email, say so as an alert
   * (`accounting_shop_invoice_email_refused`, an error that pages), every tick until it is fixed.
   */
  private async refuseShopEmails(): Promise<void> {
    const waiting = await this.deps.copies.listEmailDue(1, ["shop"]);
    if (waiting.due.length === 0 && waiting.unreadable.length === 0) return;
    const details = { reason: this.shopBaseRefusal() ?? "unknown", product: "shop" };
    if (this.deps.alerts) {
      this.deps.alerts.raise(ACCOUNTING_ALERTS.shopInvoiceEmailRefused, details);
    } else {
      this.deps.log.error(details, ACCOUNTING_ALERTS.shopInvoiceEmailRefused.message);
    }
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

  /** The storefront address for this tick's Shop emails, or null when it is unusable. */
  private shopBase(): string | null {
    try {
      return shopStorefrontBase(this.deps.shopStorefrontUrl);
    } catch {
      return null;
    }
  }

  /** Why the storefront address is unusable, or null when it is usable. */
  private shopBaseRefusal(): string | null {
    try {
      shopStorefrontBase(this.deps.shopStorefrontUrl);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "unknown";
    }
  }

  private async sendShopEmail(copy: InvoiceEmailDue, storefrontUrl: string): Promise<boolean> {
    // Only an order's own invoice is emailed here (its source id is the order id); a released
    // outside-UK delivery invoice has no email of its own yet.
    if (DELIVERY_SOURCE.test(copy.invoiceId)) {
      await this.skip(copy.documentId, "not_order_invoice");
      return false;
    }
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
        invoiceGrossPence: copy.grossPence,
        storageKey: copy.storageKey,
        storefrontUrl,
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
