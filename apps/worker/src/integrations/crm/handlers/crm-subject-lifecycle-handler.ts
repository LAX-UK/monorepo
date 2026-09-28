import type { ICrmRecordLinkRepository } from "@auction/persistence/interfaces";
import { CRM_ENTITY } from "../crm-field-constants.js";
import { CrmGatewayError } from "../crm-gateway-error.js";
import type { CrmGateway } from "../crm-gateway.js";
import { formatProviderReference } from "../crm-sync-policy.js";
import type { CrmSyncResult } from "../crm-sync-result.js";
import { CRM_TOMBSTONE_MODULE, CRM_TOMBSTONE_RECORD_ID, isRealZohoLink } from "../crm-tombstone.js";

export type CrmSubjectLifecycleHandlerDeps = {
  gateway: CrmGateway;
  linkRepo: ICrmRecordLinkRepository;
};

export class CrmSubjectLifecycleHandler {
  constructor(private readonly deps: CrmSubjectLifecycleHandlerDeps) {}

  async handleDeletionRequested(subjectId: string): Promise<CrmSyncResult> {
    await this.deps.linkRepo.setDeletionRequested(CRM_ENTITY.subject, subjectId);
    return {
      outcome: "success",
      providerReference: `subject:${subjectId}:deletion_requested`,
    };
  }

  async handleDeletionCancelled(subjectId: string): Promise<CrmSyncResult> {
    await this.deps.linkRepo.clearDeletionRequested(CRM_ENTITY.subject, subjectId);
    return {
      outcome: "success",
      providerReference: `subject:${subjectId}:deletion_cancelled`,
    };
  }

  async mergeSubjects(
    canonicalSubjectId: string,
    retiredSubjectId: string,
  ): Promise<CrmSyncResult> {
    const merge = await this.deps.linkRepo.mergeSubjectLinks({
      canonicalSubjectId,
      retiredSubjectId,
      tombstoneModule: CRM_TOMBSTONE_MODULE,
      tombstoneRecordId: CRM_TOMBSTONE_RECORD_ID,
    });
    if (merge.duplicateZohoRecordId) {
      return {
        outcome: "success",
        providerReference: `merge:${retiredSubjectId}->${canonicalSubjectId}:duplicate_zoho:${merge.duplicateZohoModule}:${merge.duplicateZohoRecordId}`,
      };
    }
    return {
      outcome: "success",
      providerReference: `merge:${retiredSubjectId}->${canonicalSubjectId}`,
    };
  }

  async eraseSubject(subjectId: string): Promise<CrmSyncResult> {
    const link = await this.deps.linkRepo.findByEntity(CRM_ENTITY.subject, subjectId);
    const cascade = await this.cascadeDeleteDealsForSubject(subjectId, link);
    if (cascade) return cascade;

    if (!link || link.erasedAt || !isRealZohoLink(link.zohoModule, link.zohoRecordId)) {
      await this.deps.linkRepo.tombstone({
        entityType: CRM_ENTITY.subject,
        entityId: subjectId,
        tombstoneModule: CRM_TOMBSTONE_MODULE,
        tombstoneRecordId: CRM_TOMBSTONE_RECORD_ID,
      });
      return { outcome: "skipped", reason: "subject_already_erased" };
    }

    const personModule = link.zohoModule as "Leads" | "Contacts" | "Deals";
    const deletePerson = await this.deps.gateway.deleteRecord({
      module: personModule,
      recordId: link.zohoRecordId,
    });
    if (deletePerson.status === "error") {
      return {
        outcome: "retry",
        error: new CrmGatewayError({
          code: deletePerson.code ?? "person_delete_failed",
          message: "person_delete_failed",
          status: 503,
          retryable: true,
        }),
      };
    }

    if (!link.recyclePurgedAt) {
      try {
        await this.deps.gateway.purgeFromRecycleBin(link.zohoRecordId);
        await this.deps.linkRepo.markRecyclePurged(CRM_ENTITY.subject, subjectId);
      } catch (err) {
        return {
          outcome: "retry",
          error: new CrmGatewayError({
            code: "recycle_bin_purge_failed",
            message: err instanceof Error ? err.message : "recycle_bin_purge_failed",
            status: 503,
            retryable: true,
          }),
        };
      }
    }

    await this.deps.linkRepo.tombstone({
      entityType: CRM_ENTITY.subject,
      entityId: subjectId,
      tombstoneModule: CRM_TOMBSTONE_MODULE,
      tombstoneRecordId: CRM_TOMBSTONE_RECORD_ID,
    });

    return {
      outcome: "success",
      providerReference: formatProviderReference({
        module: link.zohoModule,
        recordId: link.zohoRecordId,
        action: "delete",
      }),
    };
  }

  private async cascadeDeleteDealsForSubject(
    subjectId: string,
    subjectLink: Awaited<ReturnType<ICrmRecordLinkRepository["findByEntity"]>>,
  ): Promise<CrmSyncResult | null> {
    const dealIds = new Set<string>();
    for (const dealLink of await this.deps.linkRepo.listActiveDealLinksBySubject(subjectId)) {
      if (isRealZohoLink(dealLink.zohoModule, dealLink.zohoRecordId)) {
        dealIds.add(dealLink.zohoRecordId);
      }
    }
    const contactId =
      subjectLink &&
      !subjectLink.erasedAt &&
      subjectLink.zohoModule === "Contacts" &&
      isRealZohoLink(subjectLink.zohoModule, subjectLink.zohoRecordId)
        ? subjectLink.zohoRecordId
        : null;
    if (contactId) {
      for (const dealId of await this.deps.gateway.findDealIdsByContact(contactId)) {
        dealIds.add(dealId);
      }
    }
    for (const dealId of dealIds) {
      const deleteDeal = await this.deps.gateway.deleteRecord({
        module: "Deals",
        recordId: dealId,
      });
      if (deleteDeal.status === "error") {
        return {
          outcome: "retry",
          error: new CrmGatewayError({
            code: deleteDeal.code ?? "deal_delete_failed",
            message: `deal_delete_failed:${dealId}`,
            status: 503,
            retryable: true,
          }),
        };
      }
      try {
        await this.deps.gateway.purgeFromRecycleBin(dealId);
      } catch (err) {
        return {
          outcome: "retry",
          error: new CrmGatewayError({
            code: "recycle_bin_purge_failed",
            message: err instanceof Error ? err.message : "deal_recycle_purge_failed",
            status: 503,
            retryable: true,
          }),
        };
      }
      await this.deps.linkRepo.tombstoneDealByZohoRecordId(dealId);
    }
    return null;
  }
}
