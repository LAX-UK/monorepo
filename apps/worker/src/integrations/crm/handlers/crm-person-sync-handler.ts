import type { ICrmRecordLinkRepository } from "@auction/persistence/interfaces";
import { CRM_ENTITY, CRM_FIELD } from "../crm-field-constants.js";
import { CrmGatewayError, crmPersonNotLinkedError } from "../crm-gateway-error.js";
import type { CrmGateway } from "../crm-gateway.js";
import {
  evaluatePersonPatch,
  formatProviderReference,
  resolvePersonMatch,
  shouldLookupPersonByEmail,
} from "../crm-sync-policy.js";
import type { CrmSyncResult } from "../crm-sync-result.js";

export type CrmPersonSyncHandlerDeps = {
  gateway: CrmGateway;
  linkRepo: ICrmRecordLinkRepository;
  onContactLinked?: (subjectId: string) => Promise<void>;
};

export class CrmPersonSyncHandler {
  constructor(private readonly deps: CrmPersonSyncHandlerDeps) {}

  async syncPerson(
    subjectId: string,
    email: string,
    fields: Record<string, unknown>,
    mode: "upsert" | "patch",
    options?: { allowStaleLinkRecovery?: boolean },
  ): Promise<CrmSyncResult> {
    if (await this.deps.linkRepo.isDeletionRequested(CRM_ENTITY.subject, subjectId)) {
      return { outcome: "skipped", reason: "deletion_requested" };
    }
    if (await this.deps.linkRepo.isErased(CRM_ENTITY.subject, subjectId)) {
      return { outcome: "skipped", reason: "subject_erased" };
    }

    const link = await this.deps.linkRepo.findByEntity(CRM_ENTITY.subject, subjectId);
    const patchDecision = evaluatePersonPatch({ mode, link });
    if (!patchDecision.allowed) {
      return { outcome: "retry", error: crmPersonNotLinkedError() };
    }

    const emailForSearch = email || (typeof fields.Email === "string" ? fields.Email : "");
    let emailMatch = null;
    if (shouldLookupPersonByEmail(link) && emailForSearch.length > 0) {
      emailMatch =
        (await this.deps.gateway.findByEmail({ module: "Contacts", email: emailForSearch })) ??
        (await this.deps.gateway.findByEmail({ module: "Leads", email: emailForSearch }));
    }

    const match = resolvePersonMatch({
      subjectId,
      link,
      emailMatch,
      erased: false,
    });
    if (match.kind === "blocked") {
      return { outcome: "skipped", reason: match.reason };
    }

    let module: "Leads" | "Contacts" = "Leads";
    if (match.kind === "link") {
      module = match.link.zohoModule as "Leads" | "Contacts";
    } else if (match.kind === "email" && match.match) {
      module = match.match.module;
    }

    if (match.kind === "link" && mode === "patch") {
      const result = await this.deps.gateway.updateById({
        module,
        recordId: match.link.zohoRecordId,
        fields: fields as Record<string, string | number | boolean | null>,
      });
      if (result.status === "error") {
        if (options?.allowStaleLinkRecovery === false) {
          throw new CrmGatewayError({
            code: result.code ?? "ERROR",
            message: result.message ?? "crm_error",
            status: 400,
            retryable: false,
          });
        }
        return this.recoverStalePersonLink(subjectId, emailForSearch, fields, result);
      }
      return {
        outcome: "success",
        providerReference: formatProviderReference({
          module: result.module,
          recordId: result.recordId,
          action: result.action,
        }),
      };
    }

    const upsertFields = {
      ...fields,
      [CRM_FIELD.subjectExternalId]: subjectId,
    } as Record<string, string | number | boolean | null>;

    const result = await this.deps.gateway.upsert({
      module,
      fields: upsertFields,
      duplicateCheckFields: [CRM_FIELD.subjectExternalId, "Email"],
    });
    if (result.status === "error") {
      if (options?.allowStaleLinkRecovery === false) {
        throw new CrmGatewayError({
          code: result.code ?? "ERROR",
          message: result.message ?? "crm_error",
          status: 400,
          retryable: false,
        });
      }
      return this.recoverStalePersonLink(subjectId, emailForSearch, upsertFields, result);
    }
    await this.deps.linkRepo.upsertLink({
      entityType: CRM_ENTITY.subject,
      entityId: subjectId,
      zohoModule: module,
      zohoRecordId: result.recordId,
    });
    if (module === "Contacts") {
      await this.deps.onContactLinked?.(subjectId);
    }
    return {
      outcome: "success",
      providerReference: formatProviderReference({
        module: result.module,
        recordId: result.recordId,
        action: result.action,
      }),
    };
  }

  private async recoverStalePersonLink(
    subjectId: string,
    email: string,
    fields: Record<string, unknown>,
    failed: { code?: string; message?: string },
  ): Promise<CrmSyncResult> {
    if (failed.code !== "INVALID_DATA" || !email) {
      throw new CrmGatewayError({
        code: failed.code ?? "ERROR",
        message: failed.message ?? "crm_error",
        status: 400,
        retryable: false,
      });
    }
    const emailMatch =
      (await this.deps.gateway.findByEmail({ module: "Contacts", email })) ??
      (await this.deps.gateway.findByEmail({ module: "Leads", email }));
    if (!emailMatch) {
      throw new CrmGatewayError({
        code: failed.code ?? "ERROR",
        message: failed.message ?? "crm_error",
        status: 400,
        retryable: false,
      });
    }
    await this.deps.linkRepo.upsertLink({
      entityType: CRM_ENTITY.subject,
      entityId: subjectId,
      zohoModule: emailMatch.module,
      zohoRecordId: emailMatch.recordId,
    });
    if (emailMatch.module === "Contacts") {
      await this.deps.onContactLinked?.(subjectId);
    }
    return this.syncPerson(subjectId, email, fields, "patch", { allowStaleLinkRecovery: false });
  }
}
