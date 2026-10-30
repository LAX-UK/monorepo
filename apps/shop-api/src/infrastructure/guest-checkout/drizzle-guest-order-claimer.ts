import type { Database } from "@auction/db";
import {
  shopArtworkInterest,
  shopEdition,
  shopGeneralEnquiry,
  shopGuestCustomer,
  shopOrder,
  shopParty,
} from "@auction/db/schema";
import { guestOrderSubject, normaliseGuestEmail } from "@auction/shop-domain";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { GuestOrderClaimer } from "../../application/ports/guest-checkout.ports.js";
import {
  type ShopDomainEventPublisherMode,
  createShopDomainEventPublisher,
} from "../shop-domain-event-publisher.js";

/**
 * The buyer party follows the orders: the guest's party becomes the account's when the account
 * has none, otherwise the guest's orders and the prints they bought move to the account's party.
 */
async function moveBuyerParty(tx: Database, guestSubject: string, subjectId: string) {
  const [guestParty] = await tx
    .select({ id: shopParty.id })
    .from(shopParty)
    .where(eq(shopParty.identitySubjectId, guestSubject))
    .for("update")
    .limit(1);
  if (!guestParty) return;
  const [accountParty] = await tx
    .select({ id: shopParty.id })
    .from(shopParty)
    .where(eq(shopParty.identitySubjectId, subjectId))
    .for("update")
    .limit(1);
  if (!accountParty) {
    await tx
      .update(shopParty)
      .set({ identitySubjectId: subjectId })
      .where(eq(shopParty.id, guestParty.id));
    return;
  }
  await tx
    .update(shopOrder)
    .set({ buyerPartyId: accountParty.id, updatedAt: new Date() })
    .where(eq(shopOrder.buyerPartyId, guestParty.id));
  await tx
    .update(shopEdition)
    .set({ ownerPartyId: accountParty.id })
    .where(eq(shopEdition.ownerPartyId, guestParty.id));
}

/**
 * Guest enquiries sent from the email now show in the account's Enquiries. An account that
 * already asked about the same work keeps its own enquiry; the guest one stays with staff.
 */
async function claimGuestEnquiries(
  tx: Database,
  email: string,
  subjectId: string,
): Promise<number> {
  const now = new Date();
  const artwork = await tx
    .update(shopArtworkInterest)
    .set({ identitySubjectId: subjectId, updatedAt: now })
    .where(
      and(
        isNull(shopArtworkInterest.identitySubjectId),
        eq(shopArtworkInterest.intent, "enquiry"),
        sql`lower(${shopArtworkInterest.contactEmail}) = ${email}`,
        sql`NOT EXISTS (
          SELECT 1 FROM ${shopArtworkInterest} AS own
          WHERE own.artwork_id = ${shopArtworkInterest.artworkId}
            AND own.identity_subject_id = ${subjectId}
            AND own.intent = 'enquiry'
        )`,
      ),
    )
    .returning({ id: shopArtworkInterest.id });
  const general = await tx
    .update(shopGeneralEnquiry)
    .set({ identitySubjectId: subjectId, updatedAt: now })
    .where(
      and(
        isNull(shopGeneralEnquiry.identitySubjectId),
        sql`lower(${shopGeneralEnquiry.contactEmail}) = ${email}`,
      ),
    )
    .returning({ id: shopGeneralEnquiry.id });
  return artwork.length + general.length;
}

/**
 * Claims happen only for an email Identity has verified (on sign-up, or a change of email that
 * both inboxes confirmed), so nobody can take a guest's orders or enquiries by typing their
 * address into an account. Running it again for the same email claims nothing more.
 */
export function createDrizzleGuestOrderClaimer(
  db: Database,
  options: { domainEventMode: ShopDomainEventPublisherMode },
): GuestOrderClaimer {
  const events = createShopDomainEventPublisher(options.domainEventMode);
  return {
    async claimForVerifiedEmail({ subjectId, email }) {
      const normalised = normaliseGuestEmail(email);
      return db.transaction(async (tx) => {
        const claimedEnquiries = await claimGuestEnquiries(tx as Database, normalised, subjectId);
        const [guest] = await tx
          .select({ id: shopGuestCustomer.id })
          .from(shopGuestCustomer)
          .where(
            and(
              eq(shopGuestCustomer.email, normalised),
              isNull(shopGuestCustomer.claimedSubjectId),
              isNull(shopGuestCustomer.erasedAt),
            ),
          )
          .for("update")
          .limit(1);
        if (!guest) return { claimedOrders: 0, claimedEnquiries };

        const guestSubject = guestOrderSubject(guest.id);
        await moveBuyerParty(tx as Database, guestSubject, subjectId);
        const claimed = await tx
          .update(shopOrder)
          .set({ identitySubjectId: subjectId, updatedAt: new Date() })
          .where(eq(shopOrder.identitySubjectId, guestSubject))
          .returning({ id: shopOrder.id });
        const now = new Date();
        await tx
          .update(shopGuestCustomer)
          .set({ claimedSubjectId: subjectId, claimedAt: now, updatedAt: now })
          .where(eq(shopGuestCustomer.id, guest.id));
        await events.insertInTransaction(tx as Database, {
          aggregateType: "shop_guest_customer",
          aggregateId: guest.id,
          eventType: "shop.guest_lead.claimed",
          producer: "shop-api",
          payload: {
            schemaVersion: 1,
            guestCustomerId: guest.id,
            leadSubjectId: guestSubject,
            subjectId,
            claimedOrders: claimed.length,
            claimedEnquiries,
          },
        });
        return { claimedOrders: claimed.length, claimedEnquiries };
      });
    },
  };
}
