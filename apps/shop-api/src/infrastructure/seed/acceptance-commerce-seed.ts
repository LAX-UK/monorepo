import type { Database } from "@auction/db";
import {
  shopArtwork,
  shopArtworkInterest,
  shopBasket,
  shopBasketLine,
  shopEdition,
  shopOrder,
  shopOrderLine,
} from "@auction/db/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { ensureLaxShopParty } from "../ensure-lax-party.js";
import { countSellableForArtwork } from "../shop-edition-availability.js";
import { authoriseAllOwnedEditionsForTests } from "../shop-test-authority.js";
import { SHOP_SEED_BUYER_FIXTURE_SLUG, SHOP_SEED_STRIPE_CHECKOUT_SLUG } from "./catalogue-seed.js";

/** POA original used by unavailable-notify-me staging acceptance. */
export const SHOP_ACCEPTANCE_ENQUIRY_ARTWORK_SLUG = "string-study";

export const ACCEPTANCE_SELLABLE_FIXTURES = [
  { slug: SHOP_SEED_STRIPE_CHECKOUT_SLUG, minSellable: 1 },
  { slug: SHOP_SEED_BUYER_FIXTURE_SLUG, minSellable: 1 },
] as const;

/**
 * Clears enquiry interest for the acceptance identity so POA register-interest e2e can
 * click "Register interest" on every seeded run.
 */
export async function resetAcceptanceEnquiryInterestFixture(
  db: Database,
  identitySubjectId: string,
): Promise<void> {
  const subject = identitySubjectId.trim();
  if (!subject) {
    throw new Error("identitySubjectId is required for acceptance enquiry reset");
  }

  const artworkRows = await db
    .select({ id: shopArtwork.id })
    .from(shopArtwork)
    .where(eq(shopArtwork.slug, SHOP_ACCEPTANCE_ENQUIRY_ARTWORK_SLUG))
    .limit(1);
  const artworkId = artworkRows[0]?.id;
  if (!artworkId) {
    throw new Error(
      `Enquiry reset requires artwork ${SHOP_ACCEPTANCE_ENQUIRY_ARTWORK_SLUG}; run catalogue seed first`,
    );
  }

  await db
    .delete(shopArtworkInterest)
    .where(
      and(
        eq(shopArtworkInterest.artworkId, artworkId),
        eq(shopArtworkInterest.identitySubjectId, subject),
        eq(shopArtworkInterest.intent, "enquiry"),
      ),
    );
}

/** Retire the buyer basket and release checkout reservations held by pending orders. */
export async function resetAcceptanceBuyerState(
  db: Database,
  identitySubjectId: string,
): Promise<void> {
  const subject = identitySubjectId.trim();
  if (!subject) {
    throw new Error("identitySubjectId is required for acceptance buyer reset");
  }

  const now = new Date();

  await db
    .update(shopBasket)
    .set({ retiredAt: now, updatedAt: now })
    .where(and(eq(shopBasket.identitySubjectId, subject), isNull(shopBasket.retiredAt)));

  await db.transaction(async (tx) => {
    const pendingOrders = await tx
      .select({ id: shopOrder.id })
      .from(shopOrder)
      .where(
        and(
          eq(shopOrder.identitySubjectId, subject),
          inArray(shopOrder.status, ["pending_payment", "payment_failed"]),
        ),
      );

    const pendingOrderIds = pendingOrders.map((row) => row.id);
    if (pendingOrderIds.length === 0) {
      return;
    }

    const lines = await tx
      .select({ editionId: shopOrderLine.editionId })
      .from(shopOrderLine)
      .where(
        and(inArray(shopOrderLine.orderId, pendingOrderIds), isNull(shopOrderLine.releasedAt)),
      );
    const editionIds = [
      ...new Set(lines.map((row) => row.editionId).filter((id): id is string => id != null)),
    ];

    await tx
      .update(shopOrderLine)
      .set({ releasedAt: now })
      .where(
        and(inArray(shopOrderLine.orderId, pendingOrderIds), isNull(shopOrderLine.releasedAt)),
      );

    if (editionIds.length > 0) {
      await tx
        .update(shopEdition)
        .set({
          listingStatus: "authorised",
          reservedUntil: null,
          reservedByOrderId: null,
        })
        .where(and(inArray(shopEdition.id, editionIds), eq(shopEdition.listingStatus, "reserved")));
    }

    await tx
      .update(shopOrder)
      .set({ status: "expired", updatedAt: now })
      .where(inArray(shopOrder.id, pendingOrderIds));
  });
}

export async function resetSellableArtworkFixture(
  db: Database,
  artworkSlug: string,
): Promise<void> {
  const artworkRows = await db
    .select({ id: shopArtwork.id })
    .from(shopArtwork)
    .where(eq(shopArtwork.slug, artworkSlug))
    .limit(1);
  const artworkId = artworkRows[0]?.id;
  if (!artworkId) {
    throw new Error(`Acceptance reset requires artwork ${artworkSlug}; run catalogue seed first`);
  }

  const laxPartyId = await ensureLaxShopParty(db);
  const now = new Date();

  await db.transaction(async (tx) => {
    const editionRows = await tx
      .select({ id: shopEdition.id })
      .from(shopEdition)
      .where(eq(shopEdition.artworkId, artworkId));
    const editionIds = editionRows.map((row) => row.id);

    if (editionIds.length > 0) {
      const staleLines = await tx
        .select({ orderId: shopOrderLine.orderId })
        .from(shopOrderLine)
        .innerJoin(shopOrder, eq(shopOrderLine.orderId, shopOrder.id))
        .where(
          and(
            inArray(shopOrderLine.editionId, editionIds),
            isNull(shopOrderLine.releasedAt),
            inArray(shopOrder.status, ["pending_payment", "payment_failed", "paid"]),
          ),
        );

      const staleOrderIds = [...new Set(staleLines.map((row) => row.orderId))];
      if (staleOrderIds.length > 0) {
        await tx
          .update(shopOrderLine)
          .set({ releasedAt: now })
          .where(
            and(
              inArray(shopOrderLine.orderId, staleOrderIds),
              inArray(shopOrderLine.editionId, editionIds),
              isNull(shopOrderLine.releasedAt),
            ),
          );
        await tx
          .update(shopOrder)
          .set({ status: "expired", updatedAt: now })
          .where(
            and(
              inArray(shopOrder.id, staleOrderIds),
              inArray(shopOrder.status, ["pending_payment", "payment_failed", "paid"]),
            ),
          );
      }
    }

    await tx.delete(shopBasketLine).where(eq(shopBasketLine.artworkId, artworkId));

    await tx
      .update(shopEdition)
      .set({
        ownerPartyId: laxPartyId,
        listingStatus: "authorised",
        custodyStatus: "unprinted",
        saleAuthorisedAt: now,
        reservedUntil: null,
        reservedByOrderId: null,
      })
      .where(eq(shopEdition.artworkId, artworkId));
  });

  await authoriseAllOwnedEditionsForTests(db, artworkId);
}

export type ResetAcceptanceCommerceStateOptions = {
  identitySubjectId?: string;
};

/** Idempotent full commerce reset for staging acceptance (all sellable fixtures + optional buyer). */
export async function resetAcceptanceCommerceState(
  db: Database,
  options: ResetAcceptanceCommerceStateOptions = {},
): Promise<void> {
  const subjectId = options.identitySubjectId?.trim();
  if (subjectId) {
    await resetAcceptanceBuyerState(db, subjectId);
  }

  for (const fixture of ACCEPTANCE_SELLABLE_FIXTURES) {
    await resetSellableArtworkFixture(db, fixture.slug);
  }

  if (subjectId) {
    await resetAcceptanceEnquiryInterestFixture(db, subjectId);
  }

  const broken: string[] = [];
  for (const fixture of ACCEPTANCE_SELLABLE_FIXTURES) {
    const artworkRows = await db
      .select({ id: shopArtwork.id })
      .from(shopArtwork)
      .where(eq(shopArtwork.slug, fixture.slug))
      .limit(1);
    const artworkId = artworkRows[0]?.id;
    if (!artworkId) {
      broken.push(`${fixture.slug}: artwork missing`);
      continue;
    }
    const sellable = await countSellableForArtwork(db, artworkId);
    if (sellable < fixture.minSellable) {
      broken.push(`${fixture.slug}: sellable=${sellable}, need >= ${fixture.minSellable}`);
    }
  }

  if (broken.length > 0) {
    throw new Error(`Acceptance commerce reset invariant failed:\n  ${broken.join("\n  ")}`);
  }
}

/**
 * Idempotent reset of the isolated Stripe checkout fixture so repeated acceptance runs
 * do not depend on harbor-print stock.
 */
export async function resetAcceptanceStripeCheckoutFixture(db: Database): Promise<void> {
  await resetSellableArtworkFixture(db, SHOP_SEED_STRIPE_CHECKOUT_SLUG);
}

/** Restore harbour-print stock after buyer-flow e2e before staff hold fixtures. */
export async function resetAcceptanceHarborPrintFixture(db: Database): Promise<void> {
  await resetSellableArtworkFixture(db, SHOP_SEED_BUYER_FIXTURE_SLUG);
}
