import type { Database } from "@auction/db";
import { shopGuestCustomer, shopUserProfile } from "@auction/db/schema";
import { guestCustomerIdFromSubject } from "@auction/shop-domain";
import { eq } from "drizzle-orm";

export type ShopCustomerContact = { name: string | null; email: string | null };

/**
 * The name and email of an order's owner: the Shop profile of a LAX account, or what a guest
 * gave at checkout. Receipts, payment pages and invoices all read it from here.
 */
export async function readShopCustomerContact(
  db: Database,
  subject: string,
): Promise<ShopCustomerContact> {
  const guestCustomerId = guestCustomerIdFromSubject(subject);
  const [row] = guestCustomerId
    ? await db
        .select({ name: shopGuestCustomer.name, email: shopGuestCustomer.email })
        .from(shopGuestCustomer)
        .where(eq(shopGuestCustomer.id, guestCustomerId))
        .limit(1)
    : await db
        .select({ name: shopUserProfile.name, email: shopUserProfile.email })
        .from(shopUserProfile)
        .where(eq(shopUserProfile.identitySubjectId, subject))
        .limit(1);
  const email = row?.email?.trim();
  return {
    name: row?.name?.trim() || null,
    email: email?.includes("@") ? email : null,
  };
}

export async function resolveShopUserEmail(
  db: Database,
  identitySubjectId: string,
): Promise<string | null> {
  return (await readShopCustomerContact(db, identitySubjectId)).email;
}
