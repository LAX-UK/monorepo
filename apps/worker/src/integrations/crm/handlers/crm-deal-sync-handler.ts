import type { ICrmRecordLinkRepository } from "@auction/persistence/interfaces";
import type { CrmMappedIntent } from "../crm-event-mappers.js";
import { CRM_ENTITY, CRM_FIELD } from "../crm-field-constants.js";
import { CrmGatewayError } from "../crm-gateway-error.js";
import type { CrmFieldValue, CrmGateway } from "../crm-gateway.js";
import { formatProviderReference } from "../crm-sync-policy.js";
import type { CrmSyncResult } from "../crm-sync-result.js";
import { isRealZohoLink } from "../crm-tombstone.js";
import type { CrmPersonSyncHandler } from "./crm-person-sync-handler.js";

export type CrmDealSyncHandlerDeps = {
  gateway: CrmGateway;
  linkRepo: ICrmRecordLinkRepository;
  personHandler: CrmPersonSyncHandler;
  leadConversionEnabled: boolean;
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
      { [CRM_FIELD.eligibilityArt]: true },
      "patch",
    );
    if (person.outcome === "skipped") return person;
    if (person.outcome === "fatal" || person.outcome === "retry") return person;

    const contactLookup = await this.contactLookupForSubject(intent.subjectId);
    const link = await this.deps.linkRepo.findByEntity(CRM_ENTITY.deal, intent.dealEntityId);
    if (link && !link.erasedAt) {
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

    return this.createDealRecord({
      dealEntityId: intent.dealEntityId,
      subjectId: intent.subjectId,
      fields: intent.fields,
      contactLookup,
    });
  }

  async updateDealStage(dealEntityId: string, stage: string): Promise<CrmSyncResult> {
    const link = await this.deps.linkRepo.findByEntity(CRM_ENTITY.deal, dealEntityId);
    if (!link || link.erasedAt) {
      return { outcome: "skipped", reason: "deal_link_missing" };
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

  async convertLeadAndCreateDeal(
    intent: Extract<CrmMappedIntent, { kind: "convert_lead_on_win" }>,
  ): Promise<CrmSyncResult> {
    const blocked = await this.guardSubjectForDeal(intent.subjectId);
    if (blocked) return blocked;

    const subjectLink = await this.deps.linkRepo.findByEntity(CRM_ENTITY.subject, intent.subjectId);
    let contactLookup: { id: string } | null = null;

    if (subjectLink && !subjectLink.erasedAt && subjectLink.zohoModule === "Contacts") {
      contactLookup = { id: subjectLink.zohoRecordId };
    } else if (
      this.deps.leadConversionEnabled &&
      subjectLink &&
      !subjectLink.erasedAt &&
      subjectLink.zohoModule === "Leads"
    ) {
      const converted = await this.deps.gateway.convertLead({ leadId: subjectLink.zohoRecordId });
      contactLookup = { id: converted.contactId };
      await this.deps.linkRepo.upsertLink({
        entityType: CRM_ENTITY.subject,
        entityId: intent.subjectId,
        zohoModule: "Contacts",
        zohoRecordId: converted.contactId,
      });
      const update = await this.deps.gateway.updateById({
        module: "Contacts",
        recordId: converted.contactId,
        fields: { [CRM_FIELD.subjectExternalId]: intent.subjectId },
      });
      if (update.status === "error") {
        throw new CrmGatewayError({
          code: update.code ?? "contact_patch_failed",
          message: update.message ?? "contact_patch_failed",
          status: 400,
          retryable: false,
        });
      }
      await this.patchDealContactLookupsForSubject(intent.subjectId);
    }

    return this.createDealRecord({
      dealEntityId: intent.dealEntityId,
      subjectId: intent.subjectId,
      fields: intent.dealFields,
      contactLookup,
    });
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
