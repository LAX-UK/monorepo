import crypto from "node:crypto";
import type { Database } from "@auction/db";
import { emailOutbox } from "@auction/db/schema";
import type { EnquirySender } from "../application/enquiry-sender.js";
import type {
  ShopNotificationPublisher,
  ShopNotificationTx,
} from "../application/ports/shop-notification.publisher.js";
import { resolveShopUserEmail } from "./resolve-shop-user-email.js";

function asDb(tx: ShopNotificationTx): Database {
  return tx as Database;
}

function emailHash(email: string): string {
  return crypto.createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

function snapshotPurgeDate(now = new Date()): Date {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() + 30);
  return d;
}

const GENERAL_ENQUIRY_TOPIC_LABELS = {
  general: "General enquiry",
  private_viewing: "Private viewing",
  art_advisory: "Art advisory",
  selling: "Selling a work",
  exhibition: "Exhibition enquiry",
  order_problem: "Problem with a Shop order",
} as const satisfies Record<
  Parameters<ShopNotificationPublisher["queueGeneralEnquiryAlert"]>[1]["topic"],
  string
>;

/** Staff reply to the typed address; signed-in buyers who left it blank fall back to their account. */
async function enquirySenderVars(db: Database, sender: EnquirySender) {
  const buyerEmail =
    sender.contactEmail ??
    (sender.kind === "account" ? await resolveShopUserEmail(db, sender.identitySubjectId) : null);
  return {
    buyerEmail: buyerEmail ?? "unknown",
    ...(sender.contactName ? { buyerName: sender.contactName } : {}),
    ...(sender.kind === "guest" ? { guest: true } : {}),
  };
}

function formatPence(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

/** Queues one transactional email in the same transaction as the change it reports. */
export async function insertShopEmailOutbox(
  tx: Database,
  input: {
    idempotencyKey: string;
    to: string;
    template: string;
    vars: Record<string, unknown>;
  },
): Promise<void> {
  const now = new Date();
  const to = input.to.trim();
  await tx
    .insert(emailOutbox)
    .values({
      idempotencyKey: input.idempotencyKey,
      userId: null,
      toEmailHash: emailHash(to),
      toSnapshot: to,
      toSnapshotPurgeAt: snapshotPurgeDate(now),
      template: input.template,
      vars: input.vars,
      status: "pending",
      stream: "transactional",
      category: "transactional",
      flaggedAddress: false,
      createdAt: now,
    })
    .onConflictDoNothing();
}

export function createDrizzleShopNotificationPublisher(): ShopNotificationPublisher {
  return {
    async queueOrderReceipt(tx, input) {
      const db = asDb(tx);
      const to =
        (await resolveShopUserEmail(db, input.identitySubjectId)) ?? input.fallbackEmail?.trim();
      if (!to || !to.includes("@")) return;

      const orderUrl =
        input.guestOrderUrl ??
        `${input.storefrontUrl.replace(/\/+$/, "")}/account/orders/${input.orderId}`;
      const lineSummary = input.lines
        .map((line) => {
          const editionSuffix =
            line.editionNumber != null ? ` (edition ${line.editionNumber})` : "";
          return `${line.artworkTitle}${editionSuffix} — ${formatPence(line.unitPricePence)}`;
        })
        .join("\n");

      await insertShopEmailOutbox(db, {
        idempotencyKey: input.idempotencyKey,
        to,
        template: "shop-order-receipt",
        vars: {
          orderId: input.orderId,
          orderReference: input.orderReference,
          totalAmount: formatPence(input.totalPence),
          ...(input.vatAmountPence !== null
            ? { vatAmount: formatPence(input.vatAmountPence) }
            : {}),
          orderUrl,
          lineSummary,
          ...(input.guestOrderUrl ? { guest: true } : {}),
        },
      });
    },

    async queueGuestOrderLink(tx, input) {
      await insertShopEmailOutbox(asDb(tx), {
        idempotencyKey: input.idempotencyKey,
        to: input.to,
        template: "shop-guest-order-link",
        vars: {
          orderReference: input.orderReference,
          orderUrl: input.orderUrl,
          expiresOn: input.expiresOn,
        },
      });
    },

    async queueEnquiryAlert(tx, input) {
      const db = asDb(tx);
      await insertShopEmailOutbox(db, {
        idempotencyKey: input.idempotencyKey,
        to: input.opsEmail,
        template: "shop-artwork-enquiry-alert",
        vars: {
          artworkTitle: input.artworkTitle,
          artworkSlug: input.artworkSlug,
          artworkUrl: input.artworkUrl,
          ...(await enquirySenderVars(db, input.sender)),
          storefront: input.salesChannel,
          ...(input.message ? { message: input.message } : {}),
          ...(input.contactPhone ? { contactPhone: input.contactPhone } : {}),
        },
      });
    },

    async queueEnquiryAcknowledgement(tx, input) {
      const db = asDb(tx);
      const to =
        input.sender.contactEmail?.trim() ||
        (input.sender.kind === "account"
          ? await resolveShopUserEmail(db, input.sender.identitySubjectId)
          : null);
      if (!to || !to.includes("@")) return;
      await insertShopEmailOutbox(db, {
        idempotencyKey: input.idempotencyKey,
        to,
        template: "art-enquiry-received",
        vars: {
          reference: input.reference,
          ...(input.sender.contactName ? { recipientName: input.sender.contactName } : {}),
          topic: input.topic,
          storefront: input.storefront,
          ...(input.artworkTitle ? { artworkTitle: input.artworkTitle } : {}),
          ...(input.artworkUrl ? { artworkUrl: input.artworkUrl } : {}),
        },
      });
    },

    async queueGeneralEnquiryAlert(tx, input) {
      const db = asDb(tx);
      await insertShopEmailOutbox(db, {
        idempotencyKey: input.idempotencyKey,
        to: input.opsEmail,
        template: "art-general-enquiry-alert",
        vars: {
          topicLabel: GENERAL_ENQUIRY_TOPIC_LABELS[input.topic],
          ...(await enquirySenderVars(db, input.sender)),
          message: input.message,
          ...(input.contextSlug ? { contextSlug: input.contextSlug } : {}),
          ...(input.phone ? { contactPhone: input.phone } : {}),
        },
      });
    },

    async queueCheckoutOpsAlert(tx, input) {
      const db = asDb(tx);
      await insertShopEmailOutbox(db, {
        idempotencyKey: input.idempotencyKey,
        to: input.opsEmail,
        template: "shop-checkout-ops-alert",
        vars: {
          alertKind: input.alertKind,
          orderId: input.orderId,
          detail: input.detail,
        },
      });
    },

    async queueDispatchNotice(tx, input) {
      const db = asDb(tx);
      const to =
        (await resolveShopUserEmail(db, input.identitySubjectId)) ?? input.fallbackEmail?.trim();
      if (!to || !to.includes("@")) return;

      await insertShopEmailOutbox(db, {
        idempotencyKey: input.idempotencyKey,
        to,
        template: "shop-dispatch-notice",
        vars: {
          orderReference: input.orderReference,
          artworkTitle: input.artworkTitle,
          trackingUrl: input.trackingUrl,
          fulfilmentSummary: input.fulfilmentSummary,
        },
      });
    },

    async queueRefundIssued(tx, input) {
      const db = asDb(tx);
      const to =
        (await resolveShopUserEmail(db, input.identitySubjectId)) ?? input.fallbackEmail?.trim();
      if (!to || !to.includes("@")) return;

      await insertShopEmailOutbox(db, {
        idempotencyKey: input.idempotencyKey,
        to,
        template: "shop-refund-issued",
        vars: {
          orderId: input.orderId,
          orderReference: input.orderReference,
          amountPence: input.amountPence,
          buyerEmail: to,
        },
      });
    },

    async queueEditionAvailable(tx, input) {
      await insertShopEmailOutbox(asDb(tx), {
        idempotencyKey: input.idempotencyKey,
        to: input.to,
        template: "shop-edition-available-notify",
        vars: {
          artworkTitle: input.artworkTitle,
          artistName: input.artistName,
          artworkUrl: input.artworkUrl,
          unsubscribeUrl: input.unsubscribeUrl,
        },
      });
    },
  };
}
