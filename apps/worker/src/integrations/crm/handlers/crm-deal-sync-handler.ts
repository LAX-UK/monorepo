import type { ICrmRecordLinkRepository } from "@auction/persistence/interfaces";
import type { CrmMappedIntent } from "../crm-event-mappers.js";
import { CRM_ENTITY, CRM_FIELD } from "../crm-field-constants.js";
import { CrmGatewayError } from "../crm-gateway-error.js";
import type { CrmFieldValue, CrmGateway } from "../crm-gateway.js";
import { type CrmHeldDeal, readHeldDeal, toHeldPayload } from "../crm-held-deal.js";
import { formatProviderReference } from "../crm-sync-policy.js";
import type { CrmSyncResult } from "../crm-sync-result.js";
import { CRM_HELD_MODULE, isRealZohoLink } from "../crm-tombstone.js";
import type { CrmPaidBuyerHandler } from "./crm-paid-buyer-handler.js";
import type { CrmPersonSyncHandler } from "./crm-person-sync-handler.js";

export type CrmDealSyncHandlerDeps = {
  gateway: CrmGateway;
  linkRepo: ICrmRecordLinkRepository;
  personHandler: CrmPersonSyncHandler;
  paidBuyerHandler: CrmPaidBuyerHandler;
};

export class CrmDealSyncHandler {
  constructor(private readonly deps: CrmDealSyncHandlerDeps) {}

  async syncDeal(
    intent: Extract<CrmMappedIntent, { kind: "deal_upsert" }>,
  ): Promise<CrmSyncResult> {
    const blocked = await this.guardSubjectForDeal(intent.subjectId);
    if (blocked) return blocked;

    const person = await this.deps.personHandler.syncPerson(
      intent.subjectId,
      "",
      {
        [intent.purchase?.product === "LAX Bid"
          ? CRM_FIELD.eligibilityBid
          : CRM_FIELD.eligibilityArt]: true,
      },
      "patch",
    );
    if (person.outcome === "skipped") return person;
    if (person.outcome === "fatal" || person.outcome === "retry") return person;

    const contactLookup = await this.contactLookupForSubject(intent.subjectId);
    const link = await this.deps.linkRepo.findByEntity(CRM_ENTITY.deal, intent.dealEntityId);
    const existingReal =
      link && !link.erasedAt && isRealZohoLink(link.zohoModule, link.zohoRecordId);
    if (existingReal) {
      const fields = this.normalizeDealFields({
        ...intent.fields,
        ...(contactLookup ? { Contact_Name: contactLookup } : {}),
      });
      const result = await this.deps.gateway.updateById({
        module: "Deals",
        recordId: link.zohoRecordId,
        fields,
      });
      if (result.status === "error") {
        throw new CrmGatewayError({
          code: result.code ?? "ERROR",
          message: result.message ?? "deal_update_failed",
          status: 400,
          retryable: false,
        });
      }
      return {
        outcome: "success",
        providerReference: formatProviderReference({
          module: "Deals",
          recordId: link.zohoRecordId,
          action: "update",
        }),
      };
    }

    // A purchase never becomes a Deal without a Contact: it waits for an admin to convert the lead.
    if (intent.purchase && !contactLookup) {
      return this.holdDeal({
        dealEntityId: intent.dealEntityId,
        subjectId: intent.subjectId,
        held: { fields: intent.fields, purchase: intent.purchase },
      });
    }

    return this.createDealRecord({
      dealEntityId: intent.dealEntityId,
      subjectId: intent.subjectId,
      fields: intent.fields,
      contactLookup,
    });
  }

  /** Moves a purchase to its paid stage, whether its deal is in Zoho or still held. */
  async markPurchasePaid(
    intent: Extract<CrmMappedIntent, { kind: "purchase_paid" }>,
  ): Promise<CrmSyncResult> {
    const link = await this.deps.linkRepo.findByEntity(CRM_ENTITY.deal, intent.dealEntityId);
    if (!link || link.erasedAt) {
      return { outcome: "skipped", reason: "deal_link_missing" };
    }
    if (isRealZohoLink(link.zohoModule, link.zohoRecordId)) {
      return this.updateDealStage(intent.dealEntityId, intent.stage);
    }
    const held = readHeldDeal(link.heldPayload);
    if (link.zohoModule !== CRM_HELD_MODULE || !held || !link.subjectId) {
      return { outcome: "skipped", reason: "deal_link_missing" };
    }
    const blocked = await this.guardSubjectForDeal(link.subjectId);
    if (blocked) return blocked;

    const paid: CrmHeldDeal = {
      fields: {
        ...held.fields,
        Stage: intent.stage,
        Amount: intent.amount,
        Closing_Date: intent.paidAt.slice(0, 10),
      },
      purchase: { ...held.purchase, paid: true },
    };
    await this.deps.linkRepo.upsertLink({
      entityType: CRM_ENTITY.deal,
      entityId: intent.dealEntityId,
      zohoModule: CRM_HELD_MODULE,
      zohoRecordId: "__none__",
      subjectId: link.subjectId,
      heldPayload: toHeldPayload(paid),
    });
    await this.notifyPaid(intent.dealEntityId, link.subjectId, paid);
    return { outcome: "success", providerReference: `deal:${intent.dealEntityId}:held_paid` };
  }

  async updateDealStage(dealEntityId: string, stage: string): Promise<CrmSyncResult> {
    const link = await this.deps.linkRepo.findByEntity(CRM_ENTITY.deal, dealEntityId);
    if (!link || link.erasedAt) {
      return { outcome: "skipped", reason: "deal_link_missing" };
    }
    if (!isRealZohoLink(link.zohoModule, link.zohoRecordId)) {
      return { outcome: "skipped", reason: "deal_held_until_contact" };
    }
    if (link.subjectId) {
      const blocked = await this.guardSubjectForDeal(link.subjectId);
      if (blocked) return blocked;
    }
    const result = await this.deps.gateway.updateById({
      module: "Deals",
      recordId: link.zohoRecordId,
      fields: { Stage: stage },
    });
    if (result.status === "error") {
      throw new CrmGatewayError({
        code: result.code ?? "ERROR",
        message: result.message ?? "deal_stage_failed",
        status: 400,
        retryable: false,
      });
    }
    return {
      outcome: "success",
      providerReference: formatProviderReference({
        module: "Deals",
        recordId: link.zohoRecordId,
        action: "update",
      }),
    };
  }

  /**
   * Creates the Zoho Deals of every purchase held for a subject, on the subject's Contact. Safe to
   * repeat: a deal is keyed by `LAX_Deal_Key`, and its ledger row turns into a real link.
   */
  async releaseHeldDealsForSubject(subjectId: string): Promise<number> {
    const contactLookup = await this.contactLookupForSubject(subjectId);
    if (!contactLookup) return 0;
    let released = 0;
    for (const dealLink of await this.deps.linkRepo.listActiveDealLinksBySubject(subjectId)) {
      if (dealLink.zohoModule !== CRM_HELD_MODULE) continue;
      const held = readHeldDeal(dealLink.heldPayload);
      if (!held) continue;
      await this.createDealRecord({
        dealEntityId: dealLink.entityId,
        subjectId,
        fields: held.fields,
        contactLookup,
      });
      released += 1;
    }
    return released;
  }

  /** Patches Contact_Name on active Deals linked to the subject when a Contact link exists. */
  async patchDealContactLookupsForSubject(subjectId: string): Promise<void> {
    const contactLookup = await this.contactLookupForSubject(subjectId);
    if (!contactLookup) return;
    for (const dealLink of await this.deps.linkRepo.listActiveDealLinksBySubject(subjectId)) {
      if (!isRealZohoLink(dealLink.zohoModule, dealLink.zohoRecordId)) continue;
      const result = await this.deps.gateway.updateById({
        module: "Deals",
        recordId: dealLink.zohoRecordId,
        fields: { Contact_Name: contactLookup },
      });
      if (result.status === "error") {
        throw new CrmGatewayError({
          code: result.code ?? "deal_contact_patch_failed",
          message: result.message ?? "deal_contact_patch_failed",
          status: 400,
          retryable: false,
        });
      }
    }
  }

  private async holdDeal(input: {
    dealEntityId: string;
    subjectId: string;
    held: CrmHeldDeal;
  }): Promise<CrmSyncResult> {
    const existing = await this.deps.linkRepo.findByEntity(CRM_ENTITY.deal, input.dealEntityId);
    const previous =
      existing?.zohoModule === CRM_HELD_MODULE ? readHeldDeal(existing.heldPayload) : null;
    // A held deal that is already paid stays paid if the earlier event is replayed.
    const held: CrmHeldDeal = previous?.purchase.paid
      ? { fields: { ...input.held.fields, ...previous.fields }, purchase: previous.purchase }
      : input.held;
    await this.deps.linkRepo.upsertLink({
      entityType: CRM_ENTITY.deal,
      entityId: input.dealEntityId,
      zohoModule: CRM_HELD_MODULE,
      zohoRecordId: "__none__",
      subjectId: input.subjectId,
      heldPayload: toHeldPayload(held),
    });
    await this.notifyPaid(input.dealEntityId, input.subjectId, held);
    return { outcome: "success", providerReference: `deal:${input.dealEntityId}:held` };
  }

  private async notifyPaid(
    dealEntityId: string,
    subjectId: string,
    held: CrmHeldDeal,
  ): Promise<void> {
    if (!held.purchase.paid) return;
    const amount = typeof held.fields.Amount === "number" ? held.fields.Amount : 0;
    const closing = typeof held.fields.Closing_Date === "string" ? held.fields.Closing_Date : "";
    await this.deps.paidBuyerHandler.onPaid({
      subjectId,
      dealEntityId,
      dealName: typeof held.fields.Deal_Name === "string" ? held.fields.Deal_Name : dealEntityId,
      amount,
      paidAt: closing,
      product: held.purchase.product,
    });
  }

  private async createDealRecord(input: {
    dealEntityId: string;
    subjectId: string;
    fields: Record<string, CrmFieldValue>;
    contactLookup: { id: string } | null;
  }): Promise<CrmSyncResult> {
    const result = await this.deps.gateway.upsert({
      module: "Deals",
      fields: this.normalizeDealFields({
        ...input.fields,
        ...(input.contactLookup ? { Contact_Name: input.contactLookup } : {}),
      }),
      duplicateCheckFields: [CRM_FIELD.dealExternalKey],
    });
    if (result.status === "error") {
      throw new CrmGatewayError({
        code: result.code ?? "ERROR",
        message: result.message ?? "deal_upsert_failed",
        status: 400,
        retryable: false,
      });
    }
    await this.deps.linkRepo.upsertLink({
      entityType: CRM_ENTITY.deal,
      entityId: input.dealEntityId,
      zohoModule: "Deals",
      zohoRecordId: result.recordId,
      subjectId: input.subjectId,
    });
    return {
      outcome: "success",
      providerReference: formatProviderReference({
        module: "Deals",
        recordId: result.recordId,
        action: "upsert",
      }),
    };
  }

  private async guardSubjectForDeal(subjectId: string): Promise<CrmSyncResult | null> {
    if (await this.deps.linkRepo.isDeletionRequested(CRM_ENTITY.subject, subjectId)) {
      return { outcome: "skipped", reason: "deletion_requested" };
    }
    if (await this.deps.linkRepo.isErased(CRM_ENTITY.subject, subjectId)) {
      return { outcome: "skipped", reason: "subject_erased" };
    }
    return null;
  }

  private async contactLookupForSubject(subjectId: string): Promise<{ id: string } | null> {
    const subjectLink = await this.deps.linkRepo.findByEntity(CRM_ENTITY.subject, subjectId);
    if (
      !subjectLink ||
      subjectLink.erasedAt ||
      !isRealZohoLink(subjectLink.zohoModule, subjectLink.zohoRecordId)
    ) {
      return null;
    }
    if (subjectLink.zohoModule === "Contacts") {
      return { id: subjectLink.zohoRecordId };
    }
    return null;
  }

  private normalizeDealFields(
    fields: Record<string, CrmFieldValue>,
  ): Record<string, CrmFieldValue> {
    const normalized: Record<string, CrmFieldValue> = { ...fields };
    const contact = normalized.Contact_Name;
    if (typeof contact === "string") {
      normalized.Contact_Name = { id: contact };
    }
    return normalized;
  }
}
