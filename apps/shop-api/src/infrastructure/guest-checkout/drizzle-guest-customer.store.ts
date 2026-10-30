import type { Database } from "@auction/db";
import { shopGuestCustomer } from "@auction/db/schema";
import { GUEST_MARKETING_CONSENT } from "@auction/shop-domain";
import { eq } from "drizzle-orm";
import type { GuestCustomerStore } from "../../application/ports/guest-checkout.ports.js";
import type { ShopDomainEventPublisherMode } from "../shop-domain-event-publisher.js";
import { publishGuestLead } from "./guest-lead-events.js";

/**
 * One row per normalised email. A later visit refreshes the contact details and last seen; consent
 * only ever moves from no to yes here, because leaving an unticked box unticked is not a
 * withdrawal. The lead is published when it is new or its consent changes.
 */
export function createDrizzleGuestCustomerStore(
  db: Database,
  options: { domainEventMode: ShopDomainEventPublisherMode },
): GuestCustomerStore {
  return {
    async record(contact, now) {
      return db.transaction(async (tx) => {
        const inserted = await tx
          .insert(shopGuestCustomer)
          .values({
            email: contact.email,
            source: "shop_checkout",
            checkoutStartedAt: now,
            firstSeenAt: now,
            lastSeenAt: now,
          })
          .onConflictDoNothing({ target: shopGuestCustomer.email })
          .returning({ id: shopGuestCustomer.id });
        const [existing] = await tx
          .select()
          .from(shopGuestCustomer)
          .where(eq(shopGuestCustomer.email, contact.email))
          .for("update")
          .limit(1);
        if (!existing) throw new Error("Guest customer could not be recorded");

        const isNew = inserted.length > 0;
        // A lead that only enquired reaches checkout: its status changes, so it is published.
        const firstCheckout = existing.checkoutStartedAt === null;
        const consentGiven = contact.marketingConsent && !existing.marketingConsent;
        const [row] = await tx
          .update(shopGuestCustomer)
          .set({
            lastSeenAt: now,
            updatedAt: now,
            ...(firstCheckout ? { checkoutStartedAt: now } : {}),
            ...(contact.name ? { name: contact.name } : {}),
            ...(contact.phone ? { phone: contact.phone } : {}),
            ...(consentGiven
              ? {
                  marketingConsent: true,
                  marketingConsentAt: now,
                  marketingConsentVersion: GUEST_MARKETING_CONSENT.version,
                }
              : {}),
          })
          .where(eq(shopGuestCustomer.id, existing.id))
          .returning();
        if (!row) throw new Error("Guest customer could not be recorded");
        if (isNew || firstCheckout || consentGiven) {
          await publishGuestLead(tx as Database, row, options.domainEventMode);
        }
        return { guestCustomerId: row.id };
      });
    },
  };
}
