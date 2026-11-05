import {
  type AdminCertificatesToSend,
  type AdminHorsCommerceApprovalResponse,
  SHOP_API_ERROR_CODES,
} from "@auction/shop-contracts";
import { ShopDomainError, assertAuthorityReference } from "@auction/shop-domain";
import { ShopApiError, notFound } from "../../errors/shop-api-error.js";
import { withAdminIdempotency } from "../admin/with-admin-idempotency.js";
import type { Clock, PrintFulfilmentUnitOfWork, StaffCommand } from "./print-fulfilment.ports.js";

/**
 * The certificates London Art Exchange Ltd or an issuer still has to send, marking one sent, and
 * recording the artist's written authority for certificates LAX issues on their behalf.
 */
export function createCertificatesService(deps: {
  uow: PrintFulfilmentUnitOfWork;
  clock: Clock;
}) {
  const { uow, clock } = deps;

  return {
    listToSend(): Promise<AdminCertificatesToSend> {
      return uow.run(async (tx) => {
        const rows = await tx.certificates.listToSend();
        return {
          items: rows.map((row) => ({
            certificateId: row.certificateId,
            orderId: row.orderId,
            orderReference: row.orderReference,
            artworkTitle: row.artworkTitle,
            label: row.printLabel,
            issuer: row.issuer,
            form: row.form,
            createdAt: row.createdAt.toISOString(),
          })),
        };
      });
    },

    markSent(command: StaffCommand & { certificateId: string }): Promise<{ issuedAt: string }> {
      return uow.run((tx) =>
        withAdminIdempotency({
          tx,
          commandType: "certificate.mark_sent",
          idempotencyKey: command.idempotencyKey,
          actorSubjectId: command.actorSubjectId,
          requestPayload: command,
          run: async () => {
            const certificate = await tx.certificates.lock(command.certificateId);
            if (!certificate) throw notFound("Certificate not found");
            if (certificate.issuedAt) return { issuedAt: certificate.issuedAt.toISOString() };
            const at = clock.now();
            await tx.certificates.markSent({
              certificateId: certificate.certificateId,
              actorSubjectId: command.actorSubjectId,
              at,
            });
            await tx.audit.append({
              actorSubjectId: command.actorSubjectId,
              capability: "fulfilment.write",
              action: "mark_certificate_sent",
              targetType: "shop_certificate",
              targetId: certificate.certificateId,
              afterJson: { label: certificate.printLabel },
            });
            return { issuedAt: at.toISOString() };
          },
        }),
      );
    },

    recordAuthority(
      command: StaffCommand & { artworkId: string; reference: string },
    ): Promise<{ recordedAt: string }> {
      return uow.run((tx) =>
        withAdminIdempotency({
          tx,
          commandType: "certificate.record_authority",
          idempotencyKey: command.idempotencyKey,
          actorSubjectId: command.actorSubjectId,
          requestPayload: command,
          run: async () => {
            const reference = assertAuthorityReference(command.reference);
            const at = clock.now();
            const recorded = await tx.certificates.recordAuthority({
              artworkId: command.artworkId,
              reference,
              actorSubjectId: command.actorSubjectId,
              at,
            });
            if (!recorded) {
              throw new ShopDomainError("Save the edition facts before recording the authority");
            }
            await tx.audit.append({
              actorSubjectId: command.actorSubjectId,
              capability: "catalogue.write",
              action: "record_certificate_authority",
              targetType: "shop_artwork",
              targetId: command.artworkId,
              afterJson: { reference },
            });
            return { recordedAt: at.toISOString() };
          },
        }),
      );
    },

    /** Approves selling a hors commerce proof listing; approving twice keeps the first approval. */
    approveHorsCommerce(
      command: StaffCommand & { artworkId: string },
    ): Promise<AdminHorsCommerceApprovalResponse> {
      return uow.run((tx) =>
        withAdminIdempotency({
          tx,
          commandType: "listing.approve_hors_commerce",
          idempotencyKey: command.idempotencyKey,
          actorSubjectId: command.actorSubjectId,
          requestPayload: command,
          run: async () => {
            const listing = await tx.horsCommerce.lock(command.artworkId);
            if (!listing) throw notFound("Artwork not found");
            if (listing.proofType !== "hc") {
              throw new ShopApiError(
                SHOP_API_ERROR_CODES.CONFLICT,
                "Only a hors commerce proof listing needs this approval",
                409,
              );
            }
            if (listing.approvedAt && listing.approvedBy) {
              return {
                approvedAt: listing.approvedAt.toISOString(),
                approvedBy: listing.approvedBy,
              };
            }
            const at = clock.now();
            await tx.horsCommerce.approve({
              artworkId: command.artworkId,
              actorSubjectId: command.actorSubjectId,
              at,
            });
            await tx.audit.append({
              actorSubjectId: command.actorSubjectId,
              capability: "hors_commerce.approve",
              action: "approve_hors_commerce",
              targetType: "shop_artwork",
              targetId: command.artworkId,
            });
            return { approvedAt: at.toISOString(), approvedBy: command.actorSubjectId };
          },
        }),
      );
    },
  };
}

export type CertificatesService = ReturnType<typeof createCertificatesService>;
