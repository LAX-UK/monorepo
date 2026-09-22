import crypto from "node:crypto";
import type { Database } from "@auction/db";
import { emailOutbox, shopUserProfile } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type {
  ShopNotificationPublisher,
  ShopNotificationTx,
} from "../application/ports/shop-notification.publisher.js";

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

function formatPence(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

async function resolveShopUserEmail(
  tx: Database,
  identitySubjectId: string,
): Promise<string | null> {
  const [profile] = await tx
    .select({ email: shopUserProfile.email })
    .from(shopUserProfile)
    .where(eq(shopUserProfile.identitySubjectId, identitySubjectId))
    .limit(1);
  const email = profile?.email?.trim();
  return email?.includes("@") ? email : null;
}

async function insertShopEmailOutbox(
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

      const orderUrl = `${input.storefrontUrl.replace(/\/+$/, "")}/account/orders/${input.orderId}`;
      const lineSummary = input.lines
        .map(
          (line) =>
            `${line.artworkTitle} (edition ${line.editionNumber}) — ${formatPence(line.unitPricePence)}`,
        )
        .join("\n");

      await insertShopEmailOutbox(db, {
        idempotencyKey: input.idempotencyKey,
        to,
        template: "shop-order-receipt",
        vars: {
          orderId: input.orderId,
          totalAmount: formatPence(input.totalPence),
          orderUrl,
          lineSummary,
        },
      });
    },

    async queueEnquiryAlert(tx, input) {
      const db = asDb(tx);
      const buyerEmail = await resolveShopUserEmail(db, input.identitySubjectId);
      await insertShopEmailOutbox(db, {
        idempotencyKey: input.idempotencyKey,
        to: input.opsEmail,
        template: "shop-artwork-enquiry-alert",
        vars: {
          artworkTitle: input.artworkTitle,
          artworkSlug: input.artworkSlug,
          buyerEmail: buyerEmail ?? "unknown",
        },
      });
    },

    async queueEditionAvailable(tx, input) {
      const db = asDb(tx);
      const to = await resolveShopUserEmail(db, input.identitySubjectId);
      if (!to) return;
      const artworkUrl = `${input.storefrontUrl.replace(/\/+$/, "")}/artworks/${input.artworkSlug}`;
      await insertShopEmailOutbox(db, {
        idempotencyKey: input.idempotencyKey,
        to,
        template: "shop-edition-available-notify",
        vars: {
          artworkTitle: input.artworkTitle,
          artworkUrl,
        },
      });
    },
  };
}
