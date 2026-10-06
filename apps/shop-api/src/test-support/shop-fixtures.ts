import type { Database } from "@auction/db";
import {
  shopBasket,
  shopEdition,
  shopOrder,
  shopOrderLine,
  shopParty,
  shopProduct,
  shopProductVariant,
  shopStaffMember,
} from "@auction/db/schema";
import type { ShopStaffRole } from "@auction/shop-domain";
import { and, eq } from "drizzle-orm";
import { createDrizzleArtworkImportRepository } from "../infrastructure/drizzle-artwork-import.repository.js";
import { completeShopCheckoutSession } from "../infrastructure/drizzle-payment-event.processor.js";
import { createDrizzleSaleAuthorityWriter } from "../infrastructure/drizzle-sale-authority.writer.js";
export function requireDefined<T>(value: T | null | undefined, label: string): T {
  if (value === undefined || value === null) {
    throw new Error(`Missing ${label}`);
  }
  return value;
}

export function integrationSuffix(label: string): string {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function importTestArtwork(
  db: Database,
  label: string,
  options?: { printPricePence?: number },
) {
  const suffix = integrationSuffix(label);
  const importWriter = createDrizzleArtworkImportRepository(db, "off");
  const slug = `integration-${label}-${suffix}`;
  const result = await importWriter.importArtwork({
    importKey: `integration:${label}:${suffix}`,
    slug,
    title: `Integration ${label}`,
    description: null,
    primaryImageUrl: null,
    artistSlug: `integration-artist-${suffix}`,
    artistDisplayName: "Integration Artist",
    eligibleForEditionAllocation: true,
    printPricePence: options?.printPricePence ?? 5_000,
  });
  return { ...result, slug };
}

export async function selectLaxEdition(db: Database, artworkId: string) {
  const [edition] = await db
    .select()
    .from(shopEdition)
    .where(and(eq(shopEdition.artworkId, artworkId), eq(shopEdition.allocation, "lax")))
    .orderBy(shopEdition.editionNumber)
    .limit(1);
  return requireDefined(edition, "lax edition");
}

export async function grantLaxSaleAuthority(
  db: Database,
  artworkId: string,
  authorisedCount: number,
  recordedBySubjectId = "integration-staff",
) {
  const laxEdition = await selectLaxEdition(db, artworkId);
  const ownerPartyId = requireDefined(laxEdition.ownerPartyId, "lax owner party");
  const authorityWriter = createDrizzleSaleAuthorityWriter(db, "off");
  return authorityWriter.grantSaleAuthority({
    artworkId,
    ownerPartyId,
    authorisedCount,
    evidenceNote: "integration fixture grant",
    recordedBySubjectId,
  });
}

export type PendingOrderFixture = {
  orderId: string;
  editionId: string;
  sellerPartyId: string;
  totalPence: number;
  identitySubjectId: string;
  stripeSessionId: string;
};

export async function createPendingPaymentOrderWithReservedEdition(
  db: Database,
  input: {
    artworkId: string;
    suffix: string;
    totalPence?: number;
    identitySubjectId?: string;
    stripeSessionId?: string;
  },
): Promise<PendingOrderFixture> {
  const edition = await selectLaxEdition(db, input.artworkId);
  const sellerPartyId = requireDefined(edition.ownerPartyId, "seller party");
  const totalPence = input.totalPence ?? 5_000;
  const identitySubjectId = input.identitySubjectId ?? `subject-${input.suffix}`;

  const stripeSessionId = input.stripeSessionId ?? `cs_test_${input.suffix}`;
  const [orderRow] = await db
    .insert(shopOrder)
    .values({
      identitySubjectId,
      fulfilment: "collect_brunswick",
      merchandiseSubtotalPence: totalPence,
      fulfilmentSurchargePence: 0,
      totalPence,
      idempotencyKey: `idem-${input.suffix}`,
      status: "pending_payment",
      stripeCheckoutSessionId: stripeSessionId,
    })
    .returning({ id: shopOrder.id });

  const orderId = requireDefined(orderRow?.id, "order id");

  await db.insert(shopOrderLine).values({
    orderId,
    editionId: edition.id,
    artworkId: input.artworkId,
    sellerPartyId,
    editionNumber: edition.editionNumber,
    unitPricePence: totalPence,
  });

  await db
    .update(shopEdition)
    .set({
      listingStatus: "reserved",
      reservedUntil: new Date(Date.now() + 60 * 60 * 1000),
      reservedByOrderId: orderId,
    })
    .where(eq(shopEdition.id, edition.id));

  return {
    orderId,
    editionId: edition.id,
    sellerPartyId,
    totalPence,
    identitySubjectId,
    stripeSessionId,
  };
}

export async function completeFixtureOrderPayment(
  db: Database,
  fixture: PendingOrderFixture,
  eventId: string,
) {
  await completeShopCheckoutSession(
    db,
    {
      eventId,
      orderId: fixture.orderId,
      sessionId: fixture.stripeSessionId,
      amountTotalPence: fixture.totalPence,
      paidAt: new Date(),
    },
    { domainEventMode: "off" },
  );
  return fixture.orderId;
}

export async function insertTestStaffMember(
  db: Database,
  input: { identitySubjectId: string; role: ShopStaffRole },
) {
  const [row] = await db
    .insert(shopStaffMember)
    .values({
      identitySubjectId: input.identitySubjectId,
      role: input.role,
    })
    .onConflictDoUpdate({
      target: shopStaffMember.identitySubjectId,
      set: { role: input.role, disabledAt: null },
    })
    .returning({ id: shopStaffMember.id });
  return requireDefined(row?.id, "staff member id");
}

export async function insertTestOwnerParty(
  db: Database,
  input: { identitySubjectId: string; displayName?: string },
) {
  const suffix = integrationSuffix("party");
  const [row] = await db
    .insert(shopParty)
    .values({
      identitySubjectId: input.identitySubjectId,
      displayName: input.displayName ?? `Test party ${suffix}`,
      kind: "person",
    })
    .returning({ id: shopParty.id });
  return requireDefined(row?.id, "party id");
}

export async function insertTestMerchandise(
  db: Database,
  label: string,
  options?: { onHand?: number; pricePence?: number },
) {
  const suffix = integrationSuffix(label);
  const slug = `integration-merch-${label}-${suffix}`;
  const [product] = await db
    .insert(shopProduct)
    .values({
      slug,
      title: `Integration merch ${label}`,
      description: "Test merchandise fixture",
    })
    .returning({ id: shopProduct.id, slug: shopProduct.slug });
  const productId = requireDefined(product?.id, "product id");
  const productSlug = requireDefined(product?.slug, "product slug");
  const [variant] = await db
    .insert(shopProductVariant)
    .values({
      productId,
      sku: `SKU-${suffix}`,
      pricePence: options?.pricePence ?? 1_500,
      onHand: options?.onHand ?? 10,
    })
    .returning({ id: shopProductVariant.id, sku: shopProductVariant.sku });
  return {
    productId,
    variantId: requireDefined(variant?.id, "variant id"),
    slug: productSlug,
    sku: requireDefined(variant?.sku, "variant sku"),
    pricePence: options?.pricePence ?? 1_500,
  };
}

export async function insertExpiredOpenBasket(
  db: Database,
  owner: { kind: "subject"; identitySubjectId: string } | { kind: "anonymous"; tokenHash: string },
) {
  const expiredAt = new Date(Date.now() - 60_000);
  const [row] = await db
    .insert(shopBasket)
    .values({
      identitySubjectId: owner.kind === "subject" ? owner.identitySubjectId : null,
      anonymousTokenHash: owner.kind === "anonymous" ? owner.tokenHash : null,
      expiresAt: expiredAt,
      retiredAt: null,
    })
    .returning({ id: shopBasket.id });
  return requireDefined(row?.id, "basket id");
}
