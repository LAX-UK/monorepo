import type { LegalEntity } from "@auction/types";
import { Address, Contact, Contacts, type XeroClient } from "xero-node";

/** Stable Xero `ContactNumber` for idempotent find/create (≤50 chars). */
export function xeroContactNumberForLegalEntity(legalEntityId: string): string {
  const compact = legalEntityId.replace(/-/g, "");
  return `LAXLE${compact}`;
}

export type LegalEntityAddressForXero = {
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postalCode: string;
  country: string;
};

/** Returns the Xero Contact id for this legal entity, creating or re-linking
 * the contact in Xero when missing. Persists `legal_entity.xero_contact_id`
 * via `persistContactId` when a new id is obtained.
 */
export async function ensureXeroContactForLegalEntity(opts: {
  xero: XeroClient;
  tenantId: string;
  entity: Pick<LegalEntity, "id" | "displayName" | "legalName" | "vatNumber" | "xeroContactId">;
  billingAddress: LegalEntityAddressForXero | null;
  persistContactId: (legalEntityId: string, xeroContactId: string) => Promise<void>;
}): Promise<string> {
  const { xero, tenantId, entity, billingAddress, persistContactId } = opts;

  if (entity.xeroContactId) {
    return entity.xeroContactId;
  }

  const contactNumber = xeroContactNumberForLegalEntity(entity.id);
  const where = `ContactNumber=="${contactNumber}"`;
  const found = await xero.accountingApi.getContacts(
    tenantId,
    undefined,
    where,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
  );
  const existing = found.body.contacts?.[0];
  if (existing?.contactID) {
    await persistContactId(entity.id, existing.contactID);
    return existing.contactID;
  }

  const display = entity.legalName?.trim() || entity.displayName.trim();
  const c = new Contact();
  c.name = display;
  c.contactNumber = contactNumber;
  if (entity.vatNumber?.trim()) {
    c.taxNumber = entity.vatNumber.trim();
  }
  if (billingAddress) {
    const a = new Address();
    a.addressType = Address.AddressTypeEnum.STREET;
    a.addressLine1 = billingAddress.line1;
    if (billingAddress.line2) a.addressLine2 = billingAddress.line2;
    a.city = billingAddress.city;
    if (billingAddress.state) a.region = billingAddress.state;
    a.postalCode = billingAddress.postalCode;
    a.country = billingAddress.country.toUpperCase().slice(0, 2);
    c.addresses = [a];
  }

  const body = new Contacts();
  body.contacts = [c];
  const created = await xero.accountingApi.createContacts(
    tenantId,
    body,
    false,
    `legal-entity-contact-${entity.id}`,
  );
  const out = created.body.contacts?.[0];
  if (!out?.contactID) {
    throw new Error(
      out?.validationErrors?.map((v) => v.message).join("; ") || "Failed to create Xero contact",
    );
  }
  await persistContactId(entity.id, out.contactID);
  return out.contactID;
}
