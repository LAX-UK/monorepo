import type { ICrmRecordLinkRepository } from "@auction/persistence/interfaces";
import { CRM_ENTITY, CRM_FIELD } from "../crm-field-constants.js";
import { CrmGatewayError } from "../crm-gateway-error.js";
import type { CrmGateway } from "../crm-gateway.js";
import { isRealZohoLink } from "../crm-tombstone.js";
import type { CrmDealSyncHandler } from "./crm-deal-sync-handler.js";

/** A held deal is looked at again only after this long, so waiting deals cost few Zoho calls. */
export const HELD_DEAL_RECHECK_MS = 15 * 60 * 1000;
const HELD_DEALS_PER_SWEEP = 10;

export type CrmLeadConversionHandlerDeps = {
  gateway: CrmGateway;
  linkRepo: ICrmRecordLinkRepository;
  dealHandler: CrmDealSyncHandler;
  now?: () => Date;
};

export type CrmConversionSweepResult = {
  checked: number;
  released: number;
  failed: number;
};

/**
 * Admins convert leads in Zoho; the platform never does. This finds the converted ones and puts
 * the purchases that waited for them onto the new Contact.
 */
export class CrmLeadConversionHandler {
  constructor(private readonly deps: CrmLeadConversionHandlerDeps) {}

  /** Re-checks the oldest-checked waiting deals. Called on every projector tick. */
  async releaseConvertedLeads(): Promise<CrmConversionSweepResult> {
    const now = (this.deps.now ?? (() => new Date()))();
    const held = await this.deps.linkRepo.listHeldDeals(
      HELD_DEALS_PER_SWEEP,
      new Date(now.getTime() - HELD_DEAL_RECHECK_MS),
    );
    const subjects = new Set<string>();
    for (const row of held) {
      if (row.subjectId) subjects.add(row.subjectId);
    }
    const result: CrmConversionSweepResult = { checked: 0, released: 0, failed: 0 };
    for (const subjectId of subjects) {
      result.checked += 1;
      try {
        result.released += await this.releaseIfConverted(subjectId);
      } catch {
        result.failed += 1;
      }
      // Whether or not it was released, move this subject to the back of the queue.
      for (const row of held) {
        if (row.subjectId === subjectId) {
          await this.deps.linkRepo.touchLink(row.entityType, row.entityId, now);
        }
      }
    }
    return result;
  }

  /** Releases a subject's waiting deals once its lead has been converted to a Contact. */
  async releaseIfConverted(subjectId: string): Promise<number> {
    const link = await this.deps.linkRepo.findByEntity(CRM_ENTITY.subject, subjectId);
    if (!link || link.erasedAt || !isRealZohoLink(link.zohoModule, link.zohoRecordId)) return 0;

    if (link.zohoModule === "Leads") {
      const lead = await this.deps.gateway.findLead(link.zohoRecordId);
      const contactId = lead?.convertedContactId;
      if (!contactId) return 0;
      await this.deps.linkRepo.upsertLink({
        entityType: CRM_ENTITY.subject,
        entityId: subjectId,
        zohoModule: "Contacts",
        zohoRecordId: contactId,
      });
      const update = await this.deps.gateway.updateById({
        module: "Contacts",
        recordId: contactId,
        fields: { [CRM_FIELD.subjectExternalId]: subjectId },
      });
      if (update.status === "error") {
        throw new CrmGatewayError({
          code: update.code ?? "contact_patch_failed",
          message: update.message ?? "contact_patch_failed",
          status: 400,
          retryable: false,
        });
      }
    }
    const released = await this.deps.dealHandler.releaseHeldDealsForSubject(subjectId);
    await this.deps.dealHandler.patchDealContactLookupsForSubject(subjectId);
    return released;
  }
}
