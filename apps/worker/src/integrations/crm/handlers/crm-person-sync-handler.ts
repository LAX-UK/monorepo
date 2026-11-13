import type { ICrmRecordLinkRepository } from "@auction/persistence/interfaces";
import { CRM_ENTITY, CRM_FIELD, CRM_LEAD_ONLY_FIELDS } from "../crm-field-constants.js";
import {
  CrmGatewayError,
  crmPersonNotLinkedError,
  crmRecordRefusedError,
} from "../crm-gateway-error.js";
import type { CrmFieldValue, CrmGateway, CrmRecordResult } from "../crm-gateway.js";
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
  /** Told the API name of each optional field left out because the CRM refused its value. */
  onFieldDropped?: (input: { module: string; fieldApiName: string; code: string }) => void;
};

/**
 * Fields a person record cannot do without: the email, the surname Zoho requires, and the
 * platform's own id that keeps the upsert idempotent. A refusal naming one of these fails the
 * delivery; any other field the CRM refuses is left out so the person is still recorded.
 */
const REQUIRED_PERSON_FIELDS: ReadonlySet<string> = new Set([
  "Email",
  "Last_Name",
  CRM_FIELD.subjectExternalId,
]);

/** At most this many refused fields are left out of one upsert before the delivery fails. */
const MAX_DROPPED_FIELDS = 5;

type Refusal = { code: string; fieldApiName?: string | undefined };

function refusalOf(source: CrmRecordResult | CrmGatewayError): Refusal | null {
  if (source instanceof CrmGatewayError) {
    if (source.status < 400 || source.status >= 500) return null;
    return { code: source.code, fieldApiName: source.fieldApiName };
  }
  return source.status === "error"
    ? { code: source.code ?? "ERROR", fieldApiName: source.fieldApiName }
    : null;
}

function droppableField(
  refusal: Refusal | null,
  fields: Record<string, CrmFieldValue>,
): string | null {
  if (!refusal || refusal.code !== "INVALID_DATA" || !refusal.fieldApiName) return null;
  const name = refusal.fieldApiName;
  if (REQUIRED_PERSON_FIELDS.has(name) || !(name in fields)) return null;
  return name;
}

export class CrmPersonSyncHandler {
  constructor(private readonly deps: CrmPersonSyncHandlerDeps) {}

  async syncPerson(
    subjectId: string,
    email: string,
    fields: Record<string, unknown>,
    mode: "upsert" | "patch",
    options?: {
      allowStaleLinkRecovery?: boolean;
      /** Sent only when this call creates the lead; never to an existing lead or a Contact. */
      createOnlyFields?: Record<string, unknown>;
    },
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
        if (options?.allowStaleLinkRecovery === false) throw crmRecordRefusedError(result);
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
      ...(match.kind === "create_lead" ? options?.createOnlyFields : {}),
      ...fields,
      [CRM_FIELD.subjectExternalId]: subjectId,
    } as Record<string, string | number | boolean | null>;
    if (module === "Contacts") {
      // Lead-only fields do not exist on Contacts.
      for (const name of CRM_LEAD_ONLY_FIELDS) delete upsertFields[name];
    }

    const result = await this.upsertDroppingRefusedFields(module, upsertFields);
    if (result.status === "error") {
      if (options?.allowStaleLinkRecovery === false) throw crmRecordRefusedError(result);
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

  /**
   * Upserts by the platform's id, then by email, so sending the same person again updates the one
   * record. When Zoho refuses an optional field's value (a picklist value the org does not have, a
   * field it does not know), that field is left out and the upsert is sent again, so a sign-up is
   * never lost over a CRM setting; each field left out is reported to `onFieldDropped`.
   */
  private async upsertDroppingRefusedFields(
    module: "Leads" | "Contacts",
    fields: Record<string, CrmFieldValue>,
  ): Promise<CrmRecordResult> {
    let sending = fields;
    for (let dropped = 0; ; dropped += 1) {
      let outcome: CrmRecordResult | CrmGatewayError;
      try {
        outcome = await this.deps.gateway.upsert({
          module,
          fields: sending,
          duplicateCheckFields: [CRM_FIELD.subjectExternalId, "Email"],
        });
      } catch (err) {
        if (!(err instanceof CrmGatewayError)) throw err;
        outcome = err;
      }
      const refusal = refusalOf(outcome);
      const field = dropped < MAX_DROPPED_FIELDS ? droppableField(refusal, sending) : null;
      if (!field || !refusal) {
        if (outcome instanceof CrmGatewayError) throw outcome;
        return outcome;
      }
      this.deps.onFieldDropped?.({ module, fieldApiName: field, code: refusal.code });
      const { [field]: _refused, ...rest } = sending;
      sending = rest;
    }
  }

  private async recoverStalePersonLink(
    subjectId: string,
    email: string,
    fields: Record<string, unknown>,
    failed: { code?: string; message?: string; fieldApiName?: string },
  ): Promise<CrmSyncResult> {
    if (failed.code !== "INVALID_DATA" || !email) {
      throw crmRecordRefusedError(failed);
    }
    const emailMatch =
      (await this.deps.gateway.findByEmail({ module: "Contacts", email })) ??
      (await this.deps.gateway.findByEmail({ module: "Leads", email }));
    if (!emailMatch) {
      throw crmRecordRefusedError(failed);
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
