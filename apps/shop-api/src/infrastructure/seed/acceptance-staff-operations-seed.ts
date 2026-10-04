import type { Database } from "@auction/db";
import {
  shopArtwork,
  shopEdition,
  shopOrder,
  shopOrderLine,
  shopParty,
  shopProduct,
  shopProductVariant,
} from "@auction/db/schema";
import { and, asc, eq } from "drizzle-orm";
import {
  completeFixtureOrderPayment,
  createPendingPaymentOrderWithReservedEdition,
} from "../../test-support/shop-fixtures.js";
import { grantShopStaffRole } from "../grant-staff-role.js";
import { SHOP_ACCEPTANCE_ENQUIRY_ARTWORK_SLUG } from "./acceptance-commerce-seed.js";
import { SHOP_SEED_BUYER_FIXTURE_SLUG } from "./catalogue-seed.js";

/** Paid-order payout fixture — not the isolated Stripe checkout artwork. */
const SHOP_ACCEPTANCE_PAID_ORDER_ARTWORK_SLUG = "reed-study";

export const SHOP_ACCEPTANCE_STAFF_CONSIGNOR_SUBJECT = "acceptance:consignor";
export const SHOP_ACCEPTANCE_STAFF_BUYER_SUBJECT = "acceptance:buyer";

/** Merchandise smoke fixture (Phase 4). */
export const SHOP_ACCEPTANCE_MERCH_PRODUCT_SLUG = "acceptance-merch-cap";
export const SHOP_ACCEPTANCE_MERCH_SKU = "ACCEPT-MERCH-CAP-001";

/** Hold acceptance uses a foundation in-stock print. */
export const SHOP_ACCEPTANCE_HOLD_ARTWORK_SLUG = SHOP_SEED_BUYER_FIXTURE_SLUG;

/** Original sale acceptance uses the POA foundation artwork. */
export const SHOP_ACCEPTANCE_ORIGINAL_ARTWORK_SLUG = SHOP_ACCEPTANCE_ENQUIRY_ARTWORK_SLUG;

const SEED_OPERATOR = "seed:acceptance-staff-operations";

async function upsertParty(
  db: Database,
  input: { displayName: string; identitySubjectId: string },
): Promise<string> {
  const subject = input.identitySubjectId.trim();
  const existing = await db
    .select({ id: shopParty.id })
    .from(shopParty)
    .where(eq(shopParty.identitySubjectId, subject))
    .limit(1);
  if (existing[0]) {
    await db
      .update(shopParty)
      .set({ displayName: input.displayName })
      .where(eq(shopParty.id, existing[0].id));
    return existing[0].id;
  }
  const [inserted] = await db
    .insert(shopParty)
    .values({
      displayName: input.displayName,
      identitySubjectId: subject,
      kind: "person",
    })
    .returning({ id: shopParty.id });
  if (!inserted) {
    throw new Error("Failed to upsert acceptance party");
  }
  return inserted.id;
}

async function upsertMerchandiseProduct(
  db: Database,
): Promise<{ productId: string; variantId: string }> {
  const existing = await db
    .select({ id: shopProduct.id })
    .from(shopProduct)
    .where(eq(shopProduct.slug, SHOP_ACCEPTANCE_MERCH_PRODUCT_SLUG))
    .limit(1);
  let productId = existing[0]?.id;
  if (!productId) {
    const [product] = await db
      .insert(shopProduct)
      .values({
        slug: SHOP_ACCEPTANCE_MERCH_PRODUCT_SLUG,
        title: "Acceptance test cap",
        description: "TEST merchandise fixture for staging acceptance.",
      })
      .returning({ id: shopProduct.id });
    productId = product?.id;
  }
  if (!productId) {
    throw new Error("Failed to upsert acceptance merchandise product");
  }

  const variantRows = await db
    .select({ id: shopProductVariant.id })
    .from(shopProductVariant)
    .where(
      and(
        eq(shopProductVariant.productId, productId),
        eq(shopProductVariant.sku, SHOP_ACCEPTANCE_MERCH_SKU),
      ),
    )
    .limit(1);
  if (variantRows[0]) {
    await db
      .update(shopProductVariant)
      .set({ onHand: 25, pricePence: 2_500 })
      .where(eq(shopProductVariant.id, variantRows[0].id));
    return { productId, variantId: variantRows[0].id };
  }
  const [variant] = await db
    .insert(shopProductVariant)
    .values({
      productId,
      sku: SHOP_ACCEPTANCE_MERCH_SKU,
      pricePence: 2_500,
      onHand: 25,
    })
    .returning({ id: shopProductVariant.id });
  if (!variant) {
    throw new Error("Failed to upsert acceptance merchandise variant");
  }
  return { productId, variantId: variant.id };
}

export type AcceptanceStaffOperationsSeedResult = {
  adminStaffSubjectId: string;
  consignorPartyId: string;
  buyerPartyId: string;
  holdEditionId: string;
  holdArtworkId: string;
  originalArtworkId: string;
  merchandiseVariantId: string;
  paidOrderId: string;
  paidOrderLineId: string;
  paidOrderEditionId: string;
};

export async function seedAcceptanceStaffGrant(
  db: Database,
  adminStaffSubjectId: string,
): Promise<void> {
  await grantShopStaffRole(db, {
    subject: adminStaffSubjectId,
    role: "shop_admin",
    operatorSubjectId: SEED_OPERATOR,
  });
}

export async function seedAcceptanceSyntheticParties(
  db: Database,
  input: { consignorSubjectId: string; buyerSubjectId: string },
): Promise<{ consignorPartyId: string; buyerPartyId: string }> {
  const consignorPartyId = await upsertParty(db, {
    displayName: "Acceptance consignor",
    identitySubjectId: input.consignorSubjectId,
  });
  const buyerPartyId = await upsertParty(db, {
    displayName: "Acceptance buyer party",
    identitySubjectId: input.buyerSubjectId,
  });
  return { consignorPartyId, buyerPartyId };
}

export async function seedAcceptanceMerchandiseFixture(
  db: Database,
): Promise<{ productId: string; variantId: string }> {
  return upsertMerchandiseProduct(db);
}

async function seedPaidOrderAwaitingProduction(
  db: Database,
  input: { artworkId: string; buyerSubjectId: string },
): Promise<{ orderId: string; orderLineId: string; editionId: string }> {
  const idempotencyKey = "acceptance-staff-ops-paid-order";
  const existing = await db
    .select({ id: shopOrder.id })
    .from(shopOrder)
    .where(eq(shopOrder.idempotencyKey, idempotencyKey))
    .limit(1);
  if (existing[0]?.id) {
    const line = await db
      .select({ id: shopOrderLine.id })
      .from(shopOrderLine)
      .where(eq(shopOrderLine.orderId, existing[0].id))
      .limit(1);
    const orderLineId = line[0]?.id;
    if (!orderLineId) {
      throw new Error("Existing paid order fixture missing order line");
    }
    const editionRow = await db
      .select({ editionId: shopOrderLine.editionId })
      .from(shopOrderLine)
      .where(eq(shopOrderLine.id, orderLineId))
      .limit(1);
    const paidOrderEditionId = editionRow[0]?.editionId;
    if (!paidOrderEditionId) {
      throw new Error("Existing paid order fixture missing edition");
    }
    return { orderId: existing[0].id, orderLineId, editionId: paidOrderEditionId };
  }
  const suffix = "acceptance-staff-ops-paid";
  const pending = await createPendingPaymentOrderWithReservedEdition(db, {
    artworkId: input.artworkId,
    suffix,
    identitySubjectId: input.buyerSubjectId,
    stripeSessionId: "cs_test_acceptance_staff_ops_paid",
  });
  await db.update(shopOrder).set({ idempotencyKey }).where(eq(shopOrder.id, pending.orderId));
  await completeFixtureOrderPayment(db, pending, "evt-acceptance-staff-ops-paid");
  const line = await db
    .select({ id: shopOrderLine.id })
    .from(shopOrderLine)
    .where(eq(shopOrderLine.orderId, pending.orderId))
    .limit(1);
  const orderLineId = line[0]?.id;
  if (!orderLineId) {
    throw new Error("Paid order fixture missing order line");
  }
  return { orderId: pending.orderId, orderLineId, editionId: pending.editionId };
}

/**
 * Idempotent staff-operations staging fixtures: staff grant, parties, merchandise SKU, paid order, stable edition ids.
 */
export async function seedAcceptanceStaffOperationsFixtures(
  db: Database,
  options: {
    adminStaffSubjectId: string;
    consignorSubjectId?: string;
    buyerSubjectId?: string;
  },
): Promise<AcceptanceStaffOperationsSeedResult> {
  const adminStaffSubjectId = options.adminStaffSubjectId.trim();
  if (!adminStaffSubjectId) {
    throw new Error("adminStaffSubjectId is required");
  }

  await seedAcceptanceStaffGrant(db, adminStaffSubjectId);

  const consignorSubject =
    options.consignorSubjectId?.trim() || SHOP_ACCEPTANCE_STAFF_CONSIGNOR_SUBJECT;
  const buyerSubject = options.buyerSubjectId?.trim() || SHOP_ACCEPTANCE_STAFF_BUYER_SUBJECT;

  const { consignorPartyId, buyerPartyId } = await seedAcceptanceSyntheticParties(db, {
    consignorSubjectId: consignorSubject,
    buyerSubjectId: buyerSubject,
  });

  const holdArtwork = await db
    .select({ id: shopArtwork.id })
    .from(shopArtwork)
    .where(eq(shopArtwork.slug, SHOP_ACCEPTANCE_HOLD_ARTWORK_SLUG))
    .limit(1);
  const holdArtworkId = holdArtwork[0]?.id;
  if (!holdArtworkId) {
    throw new Error(
      `Phase 2 seed requires ${SHOP_ACCEPTANCE_HOLD_ARTWORK_SLUG}; run catalogue seed first`,
    );
  }
  const [holdEdition] = await db
    .select({ id: shopEdition.id })
    .from(shopEdition)
    .where(
      and(eq(shopEdition.artworkId, holdArtworkId), eq(shopEdition.listingStatus, "authorised")),
    )
    .orderBy(asc(shopEdition.editionNumber))
    .limit(1);
  if (!holdEdition) {
    throw new Error("Phase 2 seed requires an authorised edition on harbor-print");
  }

  const originalArtwork = await db
    .select({ id: shopArtwork.id })
    .from(shopArtwork)
    .where(eq(shopArtwork.slug, SHOP_ACCEPTANCE_ORIGINAL_ARTWORK_SLUG))
    .limit(1);
  const originalArtworkId = originalArtwork[0]?.id;
  if (!originalArtworkId) {
    throw new Error(
      `Phase 2 seed requires ${SHOP_ACCEPTANCE_ORIGINAL_ARTWORK_SLUG}; run catalogue seed first`,
    );
  }

  const merchandise = await seedAcceptanceMerchandiseFixture(db);
  const payoutArtwork = await db
    .select({ id: shopArtwork.id })
    .from(shopArtwork)
    .where(eq(shopArtwork.slug, SHOP_ACCEPTANCE_PAID_ORDER_ARTWORK_SLUG))
    .limit(1);
  const payoutArtworkId = payoutArtwork[0]?.id;
  if (!payoutArtworkId) {
    throw new Error(
      `Staff operations seed requires ${SHOP_ACCEPTANCE_PAID_ORDER_ARTWORK_SLUG}; run catalogue seed first`,
    );
  }
  const paid = await seedPaidOrderAwaitingProduction(db, {
    artworkId: payoutArtworkId,
    buyerSubjectId: buyerSubject,
  });

  return {
    adminStaffSubjectId,
    consignorPartyId,
    buyerPartyId,
    holdEditionId: holdEdition.id,
    holdArtworkId,
    originalArtworkId,
    merchandiseVariantId: merchandise.variantId,
    paidOrderId: paid.orderId,
    paidOrderLineId: paid.orderLineId,
    paidOrderEditionId: paid.editionId,
  };
}
