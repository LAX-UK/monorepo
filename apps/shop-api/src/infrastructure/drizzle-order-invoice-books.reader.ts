import {
  type TargetMode,
  booksTargetMode,
  laxReference,
  parseSwitchConfig,
} from "@auction/accounting-domain";
import type { Database } from "@auction/db";
import {
  accountingDocument,
  accountingDocumentCopy,
  accountingDocumentEvent,
  accountingSourceSetting,
} from "@auction/db/schema";
import { and, eq, inArray, min } from "drizzle-orm";
import type {
  OrderInvoiceBooks,
  OrderInvoiceBooksReader,
} from "../application/ports/order-invoice-books.port.js";

const d = accountingDocument;

/**
 * The mode the per-product switch aims Shop documents at in Books now, or null when it does not
 * (Books off, Xero live, or a switch that cannot be read): the one rule for whether Books takes the
 * Shop's invoices, read as shop_app from `accounting_source_setting`.
 */
export async function readShopBooksMode(db: Database): Promise<TargetMode | null> {
  const settings = await db
    .select({
      product: accountingSourceSetting.product,
      xero: accountingSourceSetting.xeroMode,
      books: accountingSourceSetting.booksMode,
    })
    .from(accountingSourceSetting);
  const config = parseSwitchConfig(
    Object.fromEntries(settings.map((s) => [s.product, { xero: s.xero, books: s.books }])),
  );
  return config.ok ? booksTargetMode(config.value.shop) : null;
}

/**
 * A Shop order's Books invoice documents, read as shop_app with the column grants it holds
 * (SHOP_ACCOUNTING_READ_COLUMNS): a document's state, number and target, its copy's key, and when
 * it was issued. Never a payload, a total or another company's document.
 */
export function createDrizzleOrderInvoiceBooksReader(db: Database): OrderInvoiceBooksReader {
  return {
    async read(orderId: string): Promise<OrderInvoiceBooks> {
      const booksMode = await readShopBooksMode(db);
      const reference = laxReference("shop", "invoice", orderId.toLowerCase());
      if (!reference.ok) return { booksMode, documents: [] };
      const rows = await db
        .select({
          id: d.id,
          targetMode: d.targetMode,
          state: d.state,
          providerNumber: d.providerNumber,
          storageKey: accountingDocumentCopy.storageKey,
          rehearsal: accountingDocumentCopy.rehearsal,
        })
        .from(d)
        .leftJoin(accountingDocumentCopy, eq(accountingDocumentCopy.documentId, d.id))
        .where(
          and(
            eq(d.product, "shop"),
            eq(d.legalEntity, "london_art_exchange"),
            eq(d.kind, "invoice"),
            eq(d.targetProvider, "books"),
            eq(d.laxReference, reference.value),
          ),
        );
      const ids = rows.map((r) => r.id);
      const issued =
        ids.length === 0
          ? []
          : await db
              .select({
                documentId: accountingDocumentEvent.documentId,
                at: min(accountingDocumentEvent.occurredAt),
              })
              .from(accountingDocumentEvent)
              .where(
                and(
                  inArray(accountingDocumentEvent.documentId, ids),
                  eq(accountingDocumentEvent.toState, "issued"),
                ),
              )
              .groupBy(accountingDocumentEvent.documentId);
      const issuedAt = new Map(issued.map((e) => [e.documentId, e.at]));
      return {
        booksMode,
        documents: rows.flatMap((r) =>
          r.targetMode === null
            ? []
            : [
                {
                  documentId: r.id,
                  targetMode: r.targetMode,
                  state: r.state,
                  providerNumber: r.providerNumber,
                  issuedAt: issuedAt.get(r.id) ?? null,
                  copy:
                    r.storageKey === null || r.rehearsal === null
                      ? null
                      : { storageKey: r.storageKey, rehearsal: r.rehearsal },
                },
              ],
        ),
      };
    },
  };
}
