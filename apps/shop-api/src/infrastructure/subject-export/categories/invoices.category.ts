import { shopDocument, shopOrder } from "@auction/db/schema";
import type { SubjectExportFileRef } from "@auction/identity-contracts";
import {
  type ExportSource,
  SourcedExportCategory,
} from "@auction/identity-contracts/subject-export-readers";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import { portalPartyRows, resolvePortalPartyScope } from "../../portal-party-scope.js";
import type { SubjectExportDeps } from "../subject-export-deps.js";
import { isoRequired, pence } from "../subject-export-values.js";
import { afterKey, countWhere } from "./keyset.js";

/** An invoice exists once an order is paid; a cancelled order's invoice no longer counts. */
const invoiceStatus = (orderStatus: string) => (orderStatus === "cancelled" ? "void" : "paid");

export function mapOrderInvoice(row: {
  id: string;
  invoiceNumber: string;
  reference: string;
  status: string;
  paidAt: Date;
  totalPence: number;
}) {
  return {
    id: `invoice:${row.id}`,
    origin: "observed" as const,
    number: row.invoiceNumber,
    orderId: row.id,
    orderReference: row.reference,
    issuedAt: isoRequired(row.paidAt),
    total: pence(row.totalPence),
    status: invoiceStatus(row.status),
    // The PDF is drawn on request from the order and is not stored, so there is no file to include.
    file: null,
  };
}

export function mapStoredInvoice(
  row: { id: string; createdAt: Date },
  file: SubjectExportFileRef | null,
) {
  return {
    id: `document:${row.id}`,
    origin: "observed" as const,
    number: null,
    orderId: null,
    orderReference: null,
    issuedAt: isoRequired(row.createdAt),
    total: null,
    status: null,
    file,
  };
}

const extension = (key: string) => /\.([A-Za-z0-9]{2,5})$/.exec(key)?.[1]?.toLowerCase() ?? null;
const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

/**
 * Invoices on the person's paid orders as data, and the invoice documents Shop stores for them as
 * signed links. Only documents marked for the client are read, never staff or internal ones.
 */
export class InvoicesCategory extends SourcedExportCategory {
  readonly id = "invoices";
  protected readonly sources: readonly ExportSource[];

  constructor({ db, files }: SubjectExportDeps) {
    super();
    const ownOrder = (s: string) =>
      and(eq(shopOrder.identitySubjectId, s), isNotNull(shopOrder.invoiceNumber));
    // Documents carry no artwork, so only parties the person owns are read.
    const documents = async (s: string) => {
      const owned = portalPartyRows(
        await resolvePortalPartyScope(db, s),
        shopDocument.partyId,
        null,
      );
      return owned
        ? and(
            owned,
            eq(shopDocument.kind, "purchase_invoice"),
            eq(shopDocument.visibility, "client"),
          )
        : null;
    };

    this.sources = [
      {
        count: (s) => countWhere(db, shopOrder, ownOrder(s)),
        page: async (s, after, limit) => {
          const rows = await db
            .select({
              id: shopOrder.id,
              invoiceNumber: shopOrder.invoiceNumber,
              reference: shopOrder.reference,
              status: shopOrder.status,
              paidAt: shopOrder.paidAt,
              totalPence: shopOrder.totalPence,
            })
            .from(shopOrder)
            .where(and(ownOrder(s), afterKey(shopOrder.id, after)))
            .orderBy(asc(shopOrder.id))
            .limit(limit);
          return rows.flatMap((row) =>
            row.invoiceNumber && row.paidAt
              ? [
                  {
                    key: row.id,
                    record: mapOrderInvoice({
                      ...row,
                      invoiceNumber: row.invoiceNumber,
                      paidAt: row.paidAt,
                    }),
                  },
                ]
              : [],
          );
        },
      },
      {
        count: async (s) => {
          const where = await documents(s);
          return where ? countWhere(db, shopDocument, where) : 0;
        },
        page: async (s, after, limit) => {
          const where = await documents(s);
          if (!where) return [];
          const rows = await db
            .select({
              id: shopDocument.id,
              objectKey: shopDocument.objectKey,
              createdAt: shopDocument.createdAt,
            })
            .from(shopDocument)
            .where(and(where, afterKey(shopDocument.id, after)))
            .orderBy(asc(shopDocument.id))
            .limit(limit);
          return Promise.all(
            rows.map(async (row) => {
              const fileName = row.objectKey.split("/").pop() || `${row.id}.pdf`;
              const ext = extension(row.objectKey);
              const file = await files.sign({
                keyOrUrl: row.objectKey,
                fileName,
                contentType: ext ? (CONTENT_TYPES[ext] ?? null) : null,
              });
              return { key: row.id, record: mapStoredInvoice(row, file) };
            }),
          );
        },
      },
    ];
  }
}
