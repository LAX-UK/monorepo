import { randomUUID } from "node:crypto";
import type { Database } from "@auction/db";
import {
  bidIdentityDirectory,
  bidUserProfile,
  legalEntity,
  legalEntityInvoiceDetails,
  legalEntityMember,
  lot,
  user,
} from "@auction/db/schema";
import { SELLER_RULE_VERSION } from "@auction/domain";
import { InvoiceRaiser } from "@auction/finance-runtime";
import { DrizzleBidInvoiceRepository } from "@auction/persistence/repositories";
import type { Lot } from "@auction/types";

/** When the fixture's lots end and their invoices are raised. */
export const RAISED_AT = new Date("2031-11-12T14:05:00Z");

/** A buyer organisation (owner pays), a seller, and nothing won yet. Fixture data only. */
export async function seedBuyer(db: Database) {
  const tag = randomUUID().slice(0, 8);
  const buyerId = `books-pay-${tag}`;
  const sellerEntityId = randomUUID();
  const buyerEntityId = randomUUID();
  await db.insert(user).values({
    id: buyerId,
    name: `Buyer ${tag}`,
    email: `${buyerId}@integration.test`,
    emailVerified: true,
    createdAt: RAISED_AT,
    updatedAt: RAISED_AT,
  });
  await db
    .insert(bidUserProfile)
    .values({ userId: buyerId, createdAt: RAISED_AT, updatedAt: RAISED_AT });
  await db.insert(bidIdentityDirectory).values({
    subjectId: buyerId,
    email: `${buyerId}@integration.test`,
    name: `Buyer ${tag}`,
    identityCreatedAt: RAISED_AT,
  });
  await db.insert(legalEntity).values(
    [sellerEntityId, buyerEntityId].map((id) => ({
      id,
      displayName: `Display ${tag}`,
      legalName: id === buyerEntityId ? `Collector Ltd ${tag}` : null,
      kind: "organisation" as const,
      subkind: "gallery" as const,
      createdByUserId: buyerId,
      status: "approved" as const,
      createdAt: RAISED_AT,
      updatedAt: RAISED_AT,
    })),
  );
  await db.insert(legalEntityMember).values({
    legalEntityId: buyerEntityId,
    userId: buyerId,
    role: "owner",
    acceptedAt: RAISED_AT,
    createdAt: RAISED_AT,
  });
  await db
    .insert(legalEntityInvoiceDetails)
    .values({ legalEntityId: buyerEntityId, billingEmail: `accounts-${tag}@integration.test` });
  return { tag, buyerId, sellerEntityId, buyerEntityId };
}
export type Buyer = Awaited<ReturnType<typeof seedBuyer>>;

/** One more lot the buyer won, its invoice raised through the one raiser (hammer + premium). */
export async function wonAndRaised(
  db: Database,
  buyer: Buyer,
  hammerPence: number,
  premiumPence: number,
) {
  const lotId = randomUUID();
  await db.insert(lot).values({
    id: lotId,
    sellerLegalEntityId: buyer.sellerEntityId,
    title: `Study ${buyer.tag}`,
    images: [],
    auctionType: "english" as const,
    startingPrice: "100.00",
    currentPrice: (hammerPence / 100).toFixed(2),
    minBidIncrement: "10.00",
    startTime: new Date(RAISED_AT.getTime() - 86_400_000),
    endTime: RAISED_AT,
    status: "ended" as const,
    winnerId: buyer.buyerId,
    buyerLegalEntityId: buyer.buyerEntityId,
    createdAt: RAISED_AT,
    updatedAt: RAISED_AT,
  });
  const raiser = new InvoiceRaiser({
    invoices: new DrizzleBidInvoiceRepository(db),
    sales: null,
    now: () => RAISED_AT,
  });
  return raiser.raise({
    lot: {
      id: lotId,
      winnerId: buyer.buyerId,
      buyerLegalEntityId: buyer.buyerEntityId,
      sellerLegalEntityId: buyer.sellerEntityId,
    } as Lot,
    priced: {
      lines: [
        { kind: "hammer", label: "Hammer price", ratePercent: null, amountPence: hammerPence },
        {
          kind: "buyers_premium",
          label: "Buyer's premium",
          ratePercent: null,
          amountPence: premiumPence,
        },
      ],
      totalPence: hammerPence + premiumPence,
      policyId: null,
      existing: null,
    },
    payment: {
      lotId,
      paidByUserId: buyer.buyerId,
      buyerLegalEntityId: buyer.buyerEntityId,
      sellerLegalEntityId: buyer.sellerEntityId,
      platformFee: "0.00",
      stripePaymentIntentId: null,
    },
    sellerTerms: {
      basis: "held",
      heldReason: "no_agreement",
      lotId,
      sellerLegalEntityId: buyer.sellerEntityId,
      hammerPence,
      premiumPence,
      ruleVersion: SELLER_RULE_VERSION,
    },
  });
}
export type Raised = Awaited<ReturnType<typeof wonAndRaised>>;
