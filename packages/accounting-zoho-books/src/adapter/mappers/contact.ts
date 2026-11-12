import type { Contact } from "@auction/accounting-domain";
import type { ZohoOrgConfig } from "../org-config.js";
import { referenceField } from "./common.js";

export interface ContactBody {
  readonly contact_name: string;
  readonly contact_type: "customer";
  readonly contact_persons?: readonly {
    readonly email: string;
    readonly is_primary_contact: true;
  }[];
  readonly custom_fields: readonly { readonly customfield_id: string; readonly value: string }[];
}

export type ContactConfig = Pick<ZohoOrgConfig, "laxReferenceField">;

/** Contact -> Books customer. The email, when we hold one, is the primary contact person. */
export function contactCreateBody(contact: Contact, config: ContactConfig): ContactBody {
  return {
    contact_name: contact.name,
    contact_type: "customer",
    ...(contact.email
      ? { contact_persons: [{ email: contact.email, is_primary_contact: true }] }
      : {}),
    ...referenceField(config, contact.reference),
  };
}

/** What an update sends: the name only. Contact persons are not rewritten, so none is lost. */
export function contactUpdateBody(contact: Contact): { readonly contact_name: string } {
  return { contact_name: contact.name };
}
