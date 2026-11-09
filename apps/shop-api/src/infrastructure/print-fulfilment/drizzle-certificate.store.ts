import type { Database } from "@auction/db";
import {
  shopArtwork,
  shopCertificate,
  shopEdition,
  shopEditionEvent,
  shopOrder,
  shopOrderLine,
} from "@auction/db/schema";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { newCertificateReference } from "../../application/print-fulfilment/confirm-print.service.js";
import type {
  CertificateStore,
  HorsCommerceApprovals,
  PrintEventWriter,
  StoredCertificate,
} from "../../application/print-fulfilment/print-fulfilment.ports.js";

type CertificateRow = typeof shopCertificate.$inferSelect;

function toStored(row: CertificateRow): StoredCertificate {
  return {
    certificateId: row.id,
    editionId: row.editionId,
    orderLineId: row.orderLineId,
    reference: row.certificateReference,
    printLabel: row.printLabel,
    issuer: row.issuer,
    form: row.form,
    issuedAt: row.issuedAt,
  };
}

/** The certificate record per print: issued, or waiting to be sent. */
export function createDrizzleCertificateStore(db: Database): CertificateStore {
  return {
    async forEditions(editionIds) {
      if (editionIds.length === 0) return [];
      const rows = await db
        .select()
        .from(shopCertificate)
        .where(inArray(shopCertificate.editionId, [...editionIds]));
      return rows.map(toStored);
    },

    async insert(certificate) {
      const [row] = await db
        .insert(shopCertificate)
        .values({
          editionId: certificate.editionId,
          orderLineId: certificate.orderLineId,
          certificateReference: newCertificateReference(),
          printLabel: certificate.printLabel,
          issuer: certificate.issuer,
          form: certificate.form,
          issuedAt: certificate.issuedAt,
          issuedBySubjectId: certificate.issuedBySubjectId,
          authorityReference: certificate.authorityReference,
        })
        .returning();
      if (!row) throw new Error("Failed to record the certificate");
      return toStored(row);
    },

    async lock(certificateId) {
      const [row] = await db
        .select()
        .from(shopCertificate)
        .where(eq(shopCertificate.id, certificateId))
        .for("update")
        .limit(1);
      return row ? toStored(row) : null;
    },

    async markSent(input) {
      await db
        .update(shopCertificate)
        .set({ issuedAt: input.at, issuedBySubjectId: input.actorSubjectId })
        .where(and(eq(shopCertificate.id, input.certificateId), isNull(shopCertificate.issuedAt)));
    },

    async listToSend() {
      const rows = await db
        .select({
          certificateId: shopCertificate.id,
          orderId: shopOrder.id,
          orderReference: shopOrder.reference,
          artworkTitle: shopArtwork.title,
          printLabel: shopCertificate.printLabel,
          issuer: shopCertificate.issuer,
          form: shopCertificate.form,
          createdAt: shopCertificate.createdAt,
        })
        .from(shopCertificate)
        .innerJoin(shopEdition, eq(shopEdition.id, shopCertificate.editionId))
        .innerJoin(shopArtwork, eq(shopArtwork.id, shopEdition.artworkId))
        .leftJoin(shopOrderLine, eq(shopOrderLine.id, shopCertificate.orderLineId))
        .leftJoin(shopOrder, eq(shopOrder.id, shopOrderLine.orderId))
        .where(isNull(shopCertificate.issuedAt))
        .orderBy(asc(shopCertificate.createdAt), asc(shopCertificate.id));
      return rows.map((row) => ({ ...row, printLabel: row.printLabel ?? "" }));
    },
  };
}

/** The history of a print: packed, set aside, sent instead, certificate issued. */
export function createDrizzlePrintEventWriter(db: Database): PrintEventWriter {
  return {
    async append(event) {
      await db.insert(shopEditionEvent).values({
        editionId: event.editionId,
        kind: event.kind,
        fromValue: event.fromValue ?? null,
        toValue: event.toValue,
        actorSubjectId: event.actorSubjectId,
        orderId: event.orderId,
      });
    },
  };
}

export function createDrizzleHorsCommerceApprovals(db: Database): HorsCommerceApprovals {
  return {
    async lock(artworkId) {
      const [row] = await db
        .select({
          artworkId: shopArtwork.id,
          proofType: shopArtwork.proofType,
          approvedAt: shopArtwork.horsCommerceApprovedAt,
          approvedBy: shopArtwork.horsCommerceApprovedBySubjectId,
        })
        .from(shopArtwork)
        .where(eq(shopArtwork.id, artworkId))
        .for("update")
        .limit(1);
      return row ?? null;
    },

    async approve(input) {
      await db
        .update(shopArtwork)
        .set({
          horsCommerceApprovedBySubjectId: input.actorSubjectId,
          horsCommerceApprovedAt: input.at,
        })
        .where(eq(shopArtwork.id, input.artworkId));
    },
  };
}
