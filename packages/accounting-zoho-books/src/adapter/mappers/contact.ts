import type { Contact } from "@auction/accounting-domain";
import type { ZohoOrgConfig } from "../org-config.js";
import { referenceField } from "./common.js";

/** Books keeps customers (we invoice them) and vendors (we bill payouts to them) as separate contacts. */
export type ContactType = "customer" | "vendor";

export interface ContactBody {
  readonly contact_name: string;
  readonly contact_type: ContactType;
  readonly contact_persons?: readonly {
    readonly email: string;
    readonly is_primary_contact: true;
  }[];
  readonly custom_fields: readonly { readonly customfield_id: string; readonly value: string }[];
}

export type ContactConfig = Pick<ZohoOrgConfig, "laxReferenceField">;

/**
 * The value the reference field holds for a contact of a type. A customer holds the LAX reference
 * itself; a vendor holds it with a `:vendor` suffix, because the field is unique across all
 * contacts and one person can be both a buyer and a seller. `:` never occurs in a LAX reference,
 * so the two can never collide with another contact's reference.
 */
export function contactReferenceValue(reference: string, type: ContactType): string {
  return type === "customer" ? reference : `${reference}:vendor`;
}

/** Contact -> Books customer or vendor. The email, when we hold one, is the primary contact person. */
export function contactCreateBody(
  contact: Contact,
  type: ContactType,
  config: ContactConfig,
): ContactBody {
  return {
    contact_name: contact.name,
    contact_type: type,
    ...(contact.email
      ? { contact_persons: [{ email: contact.email, is_primary_contact: true }] }
      : {}),
    ...referenceField(config, contactReferenceValue(contact.reference, type)),
  };
}

/** What an update sends: the name only. Contact persons are not rewritten, so none is lost. */
export function contactUpdateBody(contact: Contact): { readonly contact_name: string } {
  return { contact_name: contact.name };
}
