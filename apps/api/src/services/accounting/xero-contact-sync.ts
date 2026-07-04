import type { ILegalEntityRepository } from "@auction/persistence/interfaces";
import { Contact, Contacts, type XeroClient } from "xero-node";
import type { Env } from "../../env.js";
import type { InvoiceAccountingContext } from "../interfaces/invoice-accounting.js";
import { ensureXeroContactForLegalEntity } from "./xero-legal-entity-contact.js";

export class XeroContactSync {
  constructor(
    private readonly env: Pick<Env, "XERO_USE_LEGAL_ENTITY_CONTACT">,
    private readonly legalEntities: ILegalEntityRepository | null,
  ) {}

  async resolveContactId(
    xero: XeroClient,
    tenantId: string,
    ctx: Pick<InvoiceAccountingContext, "buyerName" | "buyerEmail" | "buyerLegalEntityId">,
  ): Promise<string> {
    if (this.env.XERO_USE_LEGAL_ENTITY_CONTACT && this.legalEntities && ctx.buyerLegalEntityId) {
      const ent = await this.legalEntities.findById(ctx.buyerLegalEntityId);
      if (!ent) {
        throw new Error("Buyer legal entity not found");
      }
      const billingAddress = await this.legalEntities.findPrimaryAddressForXero(ent.id);
      const legalEntities = this.legalEntities;
      return ensureXeroContactForLegalEntity({
        xero,
        tenantId,
        entity: ent,
        billingAddress,
        persistContactId: (id, cid) => legalEntities.setXeroContactId(id, cid),
      });
    }
    return this.ensureContact(xero, tenantId, ctx.buyerName, ctx.buyerEmail);
  }

  private async ensureContact(
    xero: XeroClient,
    tenantId: string,
    name: string,
    email: string,
  ): Promise<string> {
    const existing = await xero.accountingApi.getContacts(
      tenantId,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      email,
      undefined,
    );
    const hit = existing.body.contacts?.find(
      (c) => c.emailAddress?.toLowerCase() === email.toLowerCase(),
    );
    if (hit?.contactID) return hit.contactID;

    const c = new Contact();
    c.name = name || email;
    c.emailAddress = email;
    const body = new Contacts();
    body.contacts = [c];
    const created = await xero.accountingApi.createContacts(tenantId, body, false);
    const out = created.body.contacts?.[0];
    if (!out?.contactID) {
      throw new Error(
        out?.validationErrors?.map((v) => v.message).join("; ") || "Failed to create Xero contact",
      );
    }
    return out.contactID;
  }
}
