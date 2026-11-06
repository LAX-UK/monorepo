import { randomBytes } from "node:crypto";
import {
  type AdminConfirmPrintBody,
  type AdminConfirmPrintResponse,
  type AdminLineCertificate,
  SHOP_API_ERROR_CODES,
} from "@auction/shop-contracts";
import {
  type CertificateDecision,
  certificateToSendLabel,
  confirmPackedPrint,
  decideCertificate,
} from "@auction/shop-domain";
import { ShopApiError, notFound } from "../../errors/shop-api-error.js";
import { withAdminIdempotency } from "../admin/with-admin-idempotency.js";
import type {
  CertificateSettingsReader,
  Clock,
  PackLine,
  PrintFulfilmentTx,
  PrintFulfilmentUnitOfWork,
  RunContext,
  StaffCommand,
} from "./print-fulfilment.ports.js";
import { candidatesOf, expectedPrintOf, labelOfPrint } from "./print-identity.js";

const CAPABILITY = "fulfilment.write";

export type ConfirmPrintCommand = StaffCommand & {
  orderLineId: string;
  scanned: AdminConfirmPrintBody;
};

/** A reference the certificate carries, short enough to read out: "LAX-C-7QK2M9XD". */
export function newCertificateReference(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  let code = "";
  for (const byte of bytes) code += alphabet[byte % alphabet.length];
  return `LAX-C-${code}`;
}

function conflict(message: string): ShopApiError {
  return new ShopApiError(SHOP_API_ERROR_CODES.CONFLICT, message, 409);
}

/** The line's print can be packed only while its order is paid and the line still stands. */
export function assertPackable(line: PackLine): void {
  if (!line.paid) throw conflict("The order has not been paid");
  if (line.released) throw conflict("This order line was cancelled, so there is nothing to pack");
}

/** The pick list's account of a line's certificate, from the decision made for its print. */
export function describeCertificate(
  decision: CertificateDecision,
): Pick<AdminLineCertificate, "status" | "note"> {
  switch (decision.action) {
    case "none":
      return { status: "none", note: null };
    case "issue_digital":
      return { status: "pending_confirmation", note: "Issued to LAX Account when you confirm" };
    case "issue_with_print":
      return { status: "pending_confirmation", note: "Pack the certificate with the print" };
    case "to_send":
      return { status: "to_send", note: certificateToSendLabel(decision.reason) };
    case "blocked":
      return { status: "blocked", note: decision.reason };
  }
}

/**
 * Packing: staff scan the stock label, or type what is written on the print, and the print in
 * hand is checked against the one sold. A match records who confirmed and when, and issues the
 * certificate the run's facts call for. Anything else changes nothing and says what to do next.
 */
export function createConfirmPrintService(deps: {
  uow: PrintFulfilmentUnitOfWork;
  certificateSettings: CertificateSettingsReader;
  clock: Clock;
}) {
  const { uow, certificateSettings, clock } = deps;

  async function issueCertificate(
    tx: PrintFulfilmentTx,
    input: {
      line: PackLine;
      context: RunContext;
      label: string;
      decision: CertificateDecision;
      actorSubjectId: string;
      at: Date;
    },
  ): Promise<AdminLineCertificate> {
    const { decision, line, label, at, actorSubjectId } = input;
    if (decision.action === "none" || decision.action === "blocked") {
      return { status: "none", certificateId: null, note: null, issuedAt: null };
    }
    const issuedNow = decision.action !== "to_send";
    const stored = await tx.certificates.insert({
      editionId: line.print.editionId,
      orderLineId: line.orderLineId,
      printLabel: label,
      issuer: decision.issuer,
      form: decision.form,
      issuedAt: issuedNow ? at : null,
      issuedBySubjectId: issuedNow ? actorSubjectId : null,
      authorityReference:
        decision.issuer === "lax" ? (input.context.authority?.reference ?? null) : null,
    });
    await tx.events.append({
      editionId: line.print.editionId,
      kind: "certificate_issued",
      toValue: label,
      actorSubjectId,
      orderId: line.orderId,
    });
    return {
      status: issuedNow ? "issued" : "to_send",
      certificateId: stored.certificateId,
      note: decision.action === "to_send" ? certificateToSendLabel(decision.reason) : null,
      issuedAt: issuedNow ? at.toISOString() : null,
    };
  }

  return {
    confirm(command: ConfirmPrintCommand): Promise<AdminConfirmPrintResponse> {
      return uow.run((tx) =>
        withAdminIdempotency({
          tx,
          commandType: "print.confirm",
          idempotencyKey: command.idempotencyKey,
          actorSubjectId: command.actorSubjectId,
          requestPayload: command,
          run: async (): Promise<AdminConfirmPrintResponse> => {
            const line = await tx.lines.lock(command.orderLineId);
            if (!line) throw notFound("Order line not found");
            assertPackable(line);
            const context = await tx.lines.runContext(line.artworkId);
            const label = labelOfPrint(line.print, context.run);
            const expected = expectedPrintOf(line, context.run);

            if (line.confirmedAt) {
              // Packed already: confirming again changes nothing.
              const [existing] = await tx.certificates.forEditions([line.print.editionId]);
              return {
                outcome: "confirmed",
                label,
                certificate: {
                  status: existing ? (existing.issuedAt ? "issued" : "to_send") : "none",
                  certificateId: existing?.certificateId ?? null,
                  note: null,
                  issuedAt: existing?.issuedAt?.toISOString() ?? null,
                },
              };
            }

            // The common case needs only the print on the line; the run is read in full
            // (and locked) only when something else was scanned.
            const first = confirmPackedPrint(expected, command.scanned, []);
            if (first.outcome !== "match") {
              const others = candidatesOf(
                await tx.swaps.lockRunPrints(line.artworkId, line.print.editionId),
                context.run,
              );
              const decision = confirmPackedPrint(expected, command.scanned, others);
              if (decision.outcome === "swap_allowed" || decision.outcome === "swap_needs_admin") {
                return {
                  outcome: "swap_available",
                  needsAdmin: decision.outcome === "swap_needs_admin",
                  to: { editionId: decision.to.editionId, label: decision.to.label },
                  reason: decision.reason,
                };
              }
              if (decision.outcome === "wrong_print") {
                return {
                  outcome: "wrong_print",
                  reason: decision.reason,
                  scannedLabel: decision.scannedLabel,
                };
              }
            }

            const at = clock.now();
            const certificateDecision = context.facts
              ? decideCertificate(context.facts, {
                  laxCertificatesEnabled: certificateSettings.laxCertificatesEnabled(),
                  authorityRecorded: context.authority !== null,
                })
              : ({ action: "none" } as const);
            if (certificateDecision.action === "blocked") {
              throw conflict(certificateDecision.reason);
            }

            await tx.lines.confirm({
              orderLineId: line.orderLineId,
              actorSubjectId: command.actorSubjectId,
              at,
              printLabel: label,
            });
            await tx.events.append({
              editionId: line.print.editionId,
              kind: "pack_confirmed",
              toValue: label,
              actorSubjectId: command.actorSubjectId,
              orderId: line.orderId,
            });
            await tx.domainEvents.append({
              aggregateType: "shop_order_line",
              aggregateId: line.orderLineId,
              eventType: "shop.print.pack_confirmed",
              payload: {
                schemaVersion: 1,
                orderLineId: line.orderLineId,
                orderId: line.orderId,
                editionId: line.print.editionId,
              },
            });
            const certificate = await issueCertificate(tx, {
              line,
              context,
              label,
              decision: certificateDecision,
              actorSubjectId: command.actorSubjectId,
              at,
            });
            await tx.audit.append({
              actorSubjectId: command.actorSubjectId,
              capability: CAPABILITY,
              action: "confirm_print",
              targetType: "shop_order_line",
              targetId: line.orderLineId,
              afterJson: { label, method: command.scanned.source, certificate: certificate.status },
            });
            return { outcome: "confirmed", label, certificate };
          },
        }),
      );
    },
  };
}

export type ConfirmPrintService = ReturnType<typeof createConfirmPrintService>;
