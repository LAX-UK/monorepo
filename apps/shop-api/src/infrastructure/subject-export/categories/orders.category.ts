import {
  shopArtwork,
  shopEdition,
  shopFulfilment,
  shopOrder,
  shopOrderLine,
  shopOriginalSale,
  shopProduct,
  shopProductVariant,
  shopReturn,
} from "@auction/db/schema";
import {
  type ExportSource,
  SourcedExportCategory,
} from "@auction/identity-contracts/subject-export-readers";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { resolvePortalPartyIds } from "../../portal-party-ids.js";
import type { SubjectExportDeps } from "../subject-export-deps.js";
import { erased, iso, isoRequired, pence, workRef } from "../subject-export-values.js";
import { afterKey, countWhere } from "./keyset.js";

type Channel = "shop" | "art";

export type OrderRow = {
  id: string;
  reference: string;
  salesChannel: Channel;
  status: string;
  fulfilment: string;
  createdAt: Date;
  paidAt: Date | null;
  totalPence: number;
  deliveryRecipientName: string | null;
  deliveryLine1: string | null;
  deliveryLine2: string | null;
  deliveryCity: string | null;
  deliveryPostcode: string | null;
  deliveryCountry: string | null;
  deliveryPhone: string | null;
  personalDataErasedAt: Date | null;
};

export type OrderLineRow = {
  id: string;
  orderId: string;
  editionNumber: number | null;
  printLabel: string | null;
  unitPricePence: number;
  vatTreatment: string | null;
  vatRateBp: number | null;
  vatPence: number | null;
  artworkId: string | null;
  artworkTitle: string | null;
  artworkSlug: string | null;
  artworkChannel: Channel | null;
  productId: string | null;
  productTitle: string | null;
};

export type FulfilmentRow = {
  orderId: string;
  option: string;
  status: string;
  carrier: string | null;
  trackingNumber: string | null;
  productionStartedAt: Date | null;
  dispatchedAt: Date | null;
  readyForCollectionAt: Date | null;
  possessionAt: Date | null;
  cancelledAt: Date | null;
};

export type ReturnRow = {
  id: string;
  orderId: string;
  status: string;
  requestedAt: Date;
  receivedAt: Date | null;
};

type Origins = SubjectExportDeps["origins"];

function mapLine(row: OrderLineRow, origins: Origins) {
  const work = row.artworkId
    ? workRef(
        {
          id: row.artworkId,
          title: row.artworkTitle ?? "",
          slug: row.artworkSlug,
          salesChannel: row.artworkChannel,
        },
        origins,
      )
    : { id: row.productId ?? row.id, title: row.productTitle ?? "", url: null };
  return {
    id: row.id,
    work,
    edition:
      row.editionNumber === null && row.printLabel === null
        ? null
        : { number: row.editionNumber, label: row.printLabel },
    price: pence(row.unitPricePence),
    vat:
      row.vatPence === null
        ? null
        : { treatment: row.vatTreatment, rateBp: row.vatRateBp, amount: pence(row.vatPence) },
  };
}

function statusHistory(order: OrderRow, fulfilment: FulfilmentRow | null) {
  const steps: [string, Date | null][] = [
    ["placed", order.createdAt],
    ["paid", order.paidAt],
    ["in_production", fulfilment?.productionStartedAt ?? null],
    ["dispatched", fulfilment?.dispatchedAt ?? null],
    ["ready_for_collection", fulfilment?.readyForCollectionAt ?? null],
    ["received", fulfilment?.possessionAt ?? null],
    ["cancelled", fulfilment?.cancelledAt ?? null],
  ];
  return steps.flatMap(([status, at]) => (at ? [{ status, at: isoRequired(at) }] : []));
}

/**
 * An order as the buyer sees it. The delivery address of an order whose personal data was erased
 * comes back as erased; it is never rebuilt from the invoice or another table. Stripe identifiers,
 * the idempotency key, the seller, stock and pack-room fields, and staff handling are not selected.
 */
export function mapOrder(
  order: OrderRow,
  lines: readonly OrderLineRow[],
  fulfilment: FulfilmentRow | null,
  returns: readonly ReturnRow[],
  origins: Origins,
) {
  return {
    id: order.id,
    origin: "provided" as const,
    kind: "order",
    reference: order.reference,
    site: order.salesChannel,
    placedAt: isoRequired(order.createdAt),
    lines: lines.map((line) => mapLine(line, origins)),
    total: pence(order.totalPence),
    deliveryAddress: order.personalDataErasedAt
      ? erased(order.personalDataErasedAt)
      : {
          recipientName: order.deliveryRecipientName,
          line1: order.deliveryLine1,
          line2: order.deliveryLine2,
          city: order.deliveryCity,
          postcode: order.deliveryPostcode,
          country: order.deliveryCountry,
          phone: order.deliveryPhone,
        },
    fulfilment: fulfilment
      ? {
          option: fulfilment.option,
          status: fulfilment.status,
          carrier: fulfilment.carrier,
          trackingNumber: fulfilment.trackingNumber,
        }
      : { option: order.fulfilment, status: null, carrier: null, trackingNumber: null },
    status: order.status,
    statusHistory: statusHistory(order, fulfilment),
    returns: [
      ...returns.map((entry) => ({
        kind: "return",
        id: entry.id,
        status: entry.status,
        requestedAt: isoRequired(entry.requestedAt),
        receivedAt: iso(entry.receivedAt),
      })),
      ...(fulfilment?.cancelledAt
        ? [{ kind: "cancellation", cancelledAt: isoRequired(fulfilment.cancelledAt) }]
        : []),
    ],
  };
}

export type OriginalSaleRow = {
  id: string;
  status: string;
  salePricePence: number;
  vatTreatment: string | null;
  vatRateBp: number | null;
  vatPence: number | null;
  createdAt: Date;
  artworkId: string;
  artworkTitle: string;
  artworkSlug: string;
  salesChannel: Channel;
};

/**
 * An original work sold to the person on lax.art. Staff record these, so the staff member who
 * recorded the sale and the Stripe invoice id are not selected.
 */
export function mapOriginalSale(row: OriginalSaleRow, origins: Origins) {
  return {
    id: `original-sale:${row.id}`,
    origin: "provided" as const,
    kind: "original_sale",
    site: row.salesChannel,
    placedAt: isoRequired(row.createdAt),
    lines: [
      {
        id: row.id,
        work: workRef(
          {
            id: row.artworkId,
            title: row.artworkTitle,
            slug: row.artworkSlug,
            salesChannel: row.salesChannel,
          },
          origins,
        ),
        edition: null,
        price: pence(row.salePricePence),
        vat:
          row.vatPence === null
            ? null
            : { treatment: row.vatTreatment, rateBp: row.vatRateBp, amount: pence(row.vatPence) },
      },
    ],
    total: pence(row.salePricePence),
    status: row.status,
  };
}

/**
 * Orders placed under the person's account. A guest order appears only once the account has
 * claimed it (which moves the order to the account), so an order is never matched by email.
 */
export class OrdersCategory extends SourcedExportCategory {
  readonly id = "orders";
  protected readonly sources: readonly ExportSource[];

  constructor({ db, origins }: SubjectExportDeps) {
    super();
    this.sources = [
      {
        count: (s) => countWhere(db, shopOrder, eq(shopOrder.identitySubjectId, s)),
        page: async (s, after, limit) => {
          const orders = await db
            .select({
              id: shopOrder.id,
              reference: shopOrder.reference,
              salesChannel: shopOrder.salesChannel,
              status: shopOrder.status,
              fulfilment: shopOrder.fulfilment,
              createdAt: shopOrder.createdAt,
              paidAt: shopOrder.paidAt,
              totalPence: shopOrder.totalPence,
              deliveryRecipientName: shopOrder.deliveryRecipientName,
              deliveryLine1: shopOrder.deliveryLine1,
              deliveryLine2: shopOrder.deliveryLine2,
              deliveryCity: shopOrder.deliveryCity,
              deliveryPostcode: shopOrder.deliveryPostcode,
              deliveryCountry: shopOrder.deliveryCountry,
              deliveryPhone: shopOrder.deliveryPhone,
              personalDataErasedAt: shopOrder.personalDataErasedAt,
            })
            .from(shopOrder)
            .where(and(eq(shopOrder.identitySubjectId, s), afterKey(shopOrder.id, after)))
            .orderBy(asc(shopOrder.id))
            .limit(limit);
          if (orders.length === 0) return [];
          const ids = orders.map((order) => order.id);

          const [lines, fulfilments, returns] = await Promise.all([
            db
              .select({
                id: shopOrderLine.id,
                orderId: shopOrderLine.orderId,
                editionNumber: shopOrderLine.editionNumber,
                printLabel: shopOrderLine.printLabel,
                unitPricePence: shopOrderLine.unitPricePence,
                vatTreatment: shopOrderLine.vatTreatment,
                vatRateBp: shopOrderLine.vatRateBp,
                vatPence: shopOrderLine.vatPence,
                artworkId: shopArtwork.id,
                artworkTitle: shopArtwork.title,
                artworkSlug: shopArtwork.slug,
                artworkChannel: shopArtwork.salesChannel,
                productId: shopProduct.id,
                productTitle: shopProduct.title,
              })
              .from(shopOrderLine)
              .leftJoin(shopEdition, eq(shopEdition.id, shopOrderLine.editionId))
              .leftJoin(
                shopArtwork,
                eq(
                  shopArtwork.id,
                  sql`coalesce(${shopOrderLine.artworkId}, ${shopEdition.artworkId})`,
                ),
              )
              .leftJoin(
                shopProductVariant,
                eq(shopProductVariant.id, shopOrderLine.productVariantId),
              )
              .leftJoin(shopProduct, eq(shopProduct.id, shopProductVariant.productId))
              .where(inArray(shopOrderLine.orderId, ids))
              .orderBy(asc(shopOrderLine.createdAt), asc(shopOrderLine.id)),
            db
              .select({
                orderId: shopFulfilment.orderId,
                option: shopFulfilment.option,
                status: shopFulfilment.status,
                carrier: shopFulfilment.carrier,
                trackingNumber: shopFulfilment.trackingNumber,
                productionStartedAt: shopFulfilment.productionStartedAt,
                dispatchedAt: shopFulfilment.dispatchedAt,
                readyForCollectionAt: shopFulfilment.readyForCollectionAt,
                possessionAt: shopFulfilment.possessionAt,
                cancelledAt: shopFulfilment.cancelledAt,
              })
              .from(shopFulfilment)
              .where(inArray(shopFulfilment.orderId, ids)),
            db
              .select({
                id: shopReturn.id,
                orderId: shopOrderLine.orderId,
                status: shopReturn.status,
                requestedAt: shopReturn.createdAt,
                receivedAt: shopReturn.receivedAt,
              })
              .from(shopReturn)
              .innerJoin(shopOrderLine, eq(shopOrderLine.id, shopReturn.orderLineId))
              .where(inArray(shopOrderLine.orderId, ids))
              .orderBy(asc(shopReturn.createdAt)),
          ]);

          return orders.map((order) => ({
            key: order.id,
            record: mapOrder(
              order,
              lines.filter((line) => line.orderId === order.id),
              fulfilments.find((entry) => entry.orderId === order.id) ?? null,
              returns.filter((entry) => entry.orderId === order.id),
              origins,
            ),
          }));
        },
      },
      {
        count: async (s) => {
          const partyIds = await resolvePortalPartyIds(db, s);
          return partyIds.length === 0
            ? 0
            : countWhere(db, shopOriginalSale, inArray(shopOriginalSale.buyerPartyId, partyIds));
        },
        page: async (s, after, limit) => {
          const partyIds = await resolvePortalPartyIds(db, s);
          if (partyIds.length === 0) return [];
          const rows = await db
            .select({
              id: shopOriginalSale.id,
              status: shopOriginalSale.status,
              salePricePence: shopOriginalSale.salePricePence,
              vatTreatment: shopOriginalSale.vatTreatment,
              vatRateBp: shopOriginalSale.vatRateBp,
              vatPence: shopOriginalSale.vatPence,
              createdAt: shopOriginalSale.createdAt,
              artworkId: shopArtwork.id,
              artworkTitle: shopArtwork.title,
              artworkSlug: shopArtwork.slug,
              salesChannel: shopOriginalSale.salesChannel,
            })
            .from(shopOriginalSale)
            .innerJoin(shopArtwork, eq(shopArtwork.id, shopOriginalSale.artworkId))
            .where(
              and(
                inArray(shopOriginalSale.buyerPartyId, partyIds),
                afterKey(shopOriginalSale.id, after),
              ),
            )
            .orderBy(asc(shopOriginalSale.id))
            .limit(limit);
          return rows.map((row) => ({ key: row.id, record: mapOriginalSale(row, origins) }));
        },
      },
    ];
  }
}
