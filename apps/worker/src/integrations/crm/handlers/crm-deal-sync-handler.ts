import type {
  ClaimCrmRecordLinkInput,
  ICrmRecordLinkRepository,
} from "@auction/persistence/interfaces";
import type { CrmMappedIntent } from "../crm-event-mappers.js";
import { CRM_ENTITY, CRM_FIELD } from "../crm-field-constants.js";
import {
  CrmGatewayError,
  crmDealNotLinkedError,
  crmNoteInFlightError,
  isDefiniteCrmRefusal,
} from "../crm-gateway-error.js";
import type { CrmFieldValue, CrmGateway } from "../crm-gateway.js";
import { type CrmHeldDeal, readHeldDeal, toHeldPayload } from "../crm-held-deal.js";
import type { CrmDealSource, CrmDealSourceReader } from "../crm-readers.js";
import { formatProviderReference } from "../crm-sync-policy.js";
import type { CrmSyncResult } from "../crm-sync-result.js";
import { CRM_HELD_MODULE, CRM_TOMBSTONE_RECORD_ID, isRealZohoLink } from "../crm-tombstone.js";
import type { CrmPaidBuyerHandler } from "./crm-paid-buyer-handler.js";
import type { CrmPersonSyncHandler } from "./crm-person-sync-handler.js";

/**
 * Ledger module of a note being added: claimed before the note is sent to Zoho and replaced by the
 * real link once Zoho answers. Its id is `__none__`; its held payload keeps the deal and the note's
 * title, so a note whose send was cut off can be found in Zoho again, before it is re-sent or when
 * the person is erased.
 */
export const CRM_NOTE_PENDING_MODULE = "__note_pending__";

/** Ledger state of a note Zoho refused: not in Zoho, so it may be claimed and sent again. */
const CRM_NOTE_REFUSED = { zohoModule: "Notes", zohoRecordId: CRM_TOMBSTONE_RECORD_ID } as const;

/**
 * How long a pending note is left to the delivery that claimed it, which may still be sending it.
 * Well past one Zoho request: a note still missing after that was not sent by a running delivery.
 */
export const CRM_NOTE_PENDING_GRACE_MS = 10 * 60_000;

/** What a pending note's ledger row keeps, to find the note in Zoho again. */
export type CrmPendingNote = { dealRecordId: string; title: string };

export function readPendingNote(payload: Record<string, unknown> | null): CrmPendingNote | null {
  const dealRecordId = payload?.dealRecordId;
  const title = payload?.title;
  return typeof dealRecordId === "string" && typeof title === "string"
    ? { dealRecordId, title }
    : null;
}

export type CrmDealSyncHandlerDeps = {
  gateway: CrmGateway;
  linkRepo: ICrmRecordLinkRepository;
  personHandler: CrmPersonSyncHandler;
  paidBuyerHandler: CrmPaidBuyerHandler;
  dealSourceReader: CrmDealSourceReader;
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
      // The stage is set when the deal is created and moved only by the events that move it: a
      // replayed event never puts a later stage back.
      const { Stage: _stage, ...fieldsAfterCreate } = intent.fields;
      const fields = this.normalizeDealFields({
        ...fieldsAfterCreate,
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

  /**
   * `dealCreatedBy`: the event that creates the deal. While the deal is not in the ledger and that
   * event's delivery is still to run, this one is retried; otherwise it is skipped
   * (`deal_link_missing`), so `replay:crm-skipped` sends it again after the event that creates it.
   */
  async updateDealStage(
    dealEntityId: string,
    stage: string,
    dealCreatedBy?: CrmDealSource,
  ): Promise<CrmSyncResult> {
    const link = await this.deps.linkRepo.findByEntity(CRM_ENTITY.deal, dealEntityId);
    if (!link) return this.dealMissing(dealCreatedBy);
    if (link.erasedAt) {
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
   * Adds a note to a deal in Zoho, once: the ledger records the note, so a replay adds nothing. A
   * held deal has no Zoho record to note, as for a stage change.
   *
   * The ledger row is claimed as pending (insert, or take over a refused note's row) before the
   * note is sent, so two deliveries never both send it, and made real after. Only a definite
   * refusal (Zoho answered 4xx or refused the record, or the request was never sent) sets the row
   * back to "not added". Otherwise the row stays pending, and the note is looked up on the deal by
   * its title before it is sent again: a note is added once, never twice.
   */
  async addDealNote(
    intent: Extract<CrmMappedIntent, { kind: "deal_note" }>,
  ): Promise<CrmSyncResult> {
    const link = await this.deps.linkRepo.findByEntity(CRM_ENTITY.deal, intent.dealEntityId);
    if (!link) return this.dealMissing(intent.dealCreatedBy);
    if (link.erasedAt) {
      return { outcome: "skipped", reason: "deal_link_missing" };
    }
    if (!isRealZohoLink(link.zohoModule, link.zohoRecordId)) {
      return { outcome: "skipped", reason: "deal_held_until_contact" };
    }
    if (link.subjectId) {
      const blocked = await this.guardSubjectForDeal(link.subjectId);
      if (blocked) return blocked;
    }
    const subject = link.subjectId ? { subjectId: link.subjectId } : {};
    const pendingState = {
      zohoModule: CRM_NOTE_PENDING_MODULE,
      zohoRecordId: CRM_TOMBSTONE_RECORD_ID,
    };
    const pending = {
      entityType: CRM_ENTITY.note,
      entityId: intent.noteRecordId,
      ...pendingState,
      heldPayload: { dealRecordId: link.zohoRecordId, title: intent.title },
      ...subject,
    };
    const recorded = await this.deps.linkRepo.findByEntity(CRM_ENTITY.note, intent.noteRecordId);
    // Erasure removed the note with the person's other records.
    if (recorded?.erasedAt) return { outcome: "skipped", reason: "subject_erased" };
    if (recorded && isRealZohoLink(recorded.zohoModule, recorded.zohoRecordId)) {
      return noteAdded(recorded.zohoRecordId);
    }
    let from: ClaimCrmRecordLinkInput["from"] = CRM_NOTE_REFUSED;
    if (recorded?.zohoModule === CRM_NOTE_PENDING_MODULE) {
      // A send was cut off: the note may be in Zoho. Sent again only when it is not there and no
      // live delivery can still be sending it.
      const [found] = await this.deps.gateway.findNoteIds({
        parentModule: "Deals",
        parentId: link.zohoRecordId,
        title: intent.title,
      });
      if (found) return this.recordNote(intent.noteRecordId, found, subject);
      from = { ...pendingState, updatedBefore: new Date(Date.now() - CRM_NOTE_PENDING_GRACE_MS) };
    }
    const claimed = await this.deps.linkRepo.claimLink({ ...pending, from });
    // Another delivery holds the note: it is tried again once that one is done.
    if (!claimed) return { outcome: "retry", error: crmNoteInFlightError() };

    const refused = () =>
      this.deps.linkRepo.upsertLink({
        entityType: CRM_ENTITY.note,
        entityId: intent.noteRecordId,
        ...CRM_NOTE_REFUSED,
        ...subject,
      });
    let note: Awaited<ReturnType<CrmGateway["createRecord"]>>;
    try {
      note = await this.deps.gateway.createRecord({
        module: "Notes",
        fields: {
          Note_Title: intent.title,
          Note_Content: intent.content,
          Parent_Id: { id: link.zohoRecordId, module: { api_name: "Deals" } },
        },
      });
    } catch (error) {
      if (isDefiniteCrmRefusal(error)) await refused();
      throw error;
    }
    if (note.status === "error") {
      await refused();
      throw new CrmGatewayError({
        code: note.code ?? "ERROR",
        message: note.message ?? "deal_note_failed",
        status: 400,
        retryable: false,
      });
    }
    return this.recordNote(intent.noteRecordId, note.recordId, subject);
  }

  private async recordNote(
    noteRecordId: string,
    zohoRecordId: string,
    subject: { subjectId?: string },
  ): Promise<CrmSyncResult> {
    await this.deps.linkRepo.upsertLink({
      entityType: CRM_ENTITY.note,
      entityId: noteRecordId,
      zohoModule: "Notes",
      zohoRecordId,
      ...subject,
    });
    return noteAdded(zohoRecordId);
  }

  /** The deal is not in the ledger: retried while the event that creates it is still to run. */
  private async dealMissing(dealCreatedBy?: CrmDealSource): Promise<CrmSyncResult> {
    if (dealCreatedBy && (await this.deps.dealSourceReader.isDeliveryInFlight(dealCreatedBy))) {
      return { outcome: "retry", error: crmDealNotLinkedError() };
    }
    return { outcome: "skipped", reason: "deal_link_missing" };
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

function noteAdded(zohoRecordId: string): CrmSyncResult {
  return {
    outcome: "success",
    providerReference: formatProviderReference({
      module: "Notes",
      recordId: zohoRecordId,
      action: "insert",
    }),
  };
}
