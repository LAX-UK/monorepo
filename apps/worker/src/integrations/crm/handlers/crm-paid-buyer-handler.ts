import { dayKey } from "@auction/datetime";
import type { ICrmRecordLinkRepository } from "@auction/persistence/interfaces";
import { CRM_ENTITY, CRM_LEAD_STATUS, paidCustomerRecordId } from "../crm-field-constants.js";
import { CrmGatewayError } from "../crm-gateway-error.js";
import type { CrmFieldValue, CrmGateway, CrmModule, CrmRecordResult } from "../crm-gateway.js";
import { isRealZohoLink } from "../crm-tombstone.js";

export const PAID_CUSTOMER_TASK_SUBJECT = "Paid customer: please convert";

export type CrmPaidPurchase = {
  subjectId: string;
  dealEntityId: string;
  dealName: string;
  amount: number;
  paidAt: string;
  product: string;
};

export type CrmPaidBuyerHandlerDeps = {
  gateway: CrmGateway;
  linkRepo: ICrmRecordLinkRepository;
  now?: () => Date;
};

/** The calendar day after `now` in London, as Zoho's date fields take it. */
export function dueTomorrowInLondon(now: Date): string {
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return dayKey(tomorrow, "Europe/London");
}

export function purchaseNoteContent(purchase: CrmPaidPurchase): string {
  return [
    `Paid purchase: ${purchase.dealName}`,
    `Amount: ${purchase.amount.toFixed(2)}`,
    `Date: ${purchase.paidAt.slice(0, 10)}`,
    `Product: ${purchase.product}`,
    "The purchase is held until this lead is converted to a client.",
  ].join("\n");
}

/**
 * A buyer who has paid but whose lead nobody has converted yet: the lead moves to Qualified, a note
 * records the purchase and a task asks the admin team to convert them. Each step is recorded in
 * the delivery ledger once done, so a retry never doubles a note or a task.
 */
export class CrmPaidBuyerHandler {
  constructor(private readonly deps: CrmPaidBuyerHandlerDeps) {}

  async onPaid(purchase: CrmPaidPurchase): Promise<void> {
    const subjectLink = await this.deps.linkRepo.findByEntity(
      CRM_ENTITY.subject,
      purchase.subjectId,
    );
    if (
      !subjectLink ||
      subjectLink.erasedAt ||
      subjectLink.zohoModule !== "Leads" ||
      !isRealZohoLink(subjectLink.zohoModule, subjectLink.zohoRecordId)
    ) {
      return;
    }
    const leadId = subjectLink.zohoRecordId;
    const lead = await this.deps.gateway.findLead(leadId);
    // A converted lead has a Contact: the held deal is released by the conversion check.
    if (lead?.convertedContactId) return;

    if (
      lead?.status &&
      (CRM_LEAD_STATUS.upgradableToQualified as readonly string[]).includes(lead.status)
    ) {
      this.assertOk(
        await this.deps.gateway.updateById({
          module: "Leads",
          recordId: leadId,
          fields: { Lead_Status: CRM_LEAD_STATUS.qualified },
        }),
        "lead_qualify_failed",
      );
    }

    const recordId = paidCustomerRecordId(purchase.dealEntityId);
    if (!(await this.deps.linkRepo.findByEntity(CRM_ENTITY.note, recordId))) {
      const note = await this.deps.gateway.createRecord({
        module: "Notes",
        fields: {
          Note_Title: "Paid purchase",
          Note_Content: purchaseNoteContent(purchase),
          Parent_Id: { id: leadId, module: { api_name: "Leads" } },
        },
      });
      this.assertOk(note, "purchase_note_failed");
      await this.recordInLedger(CRM_ENTITY.note, recordId, "Notes", note.recordId, purchase);
    }

    if (!(await this.deps.linkRepo.findByEntity(CRM_ENTITY.task, recordId))) {
      const fields: Record<string, CrmFieldValue> = {
        Subject: PAID_CUSTOMER_TASK_SUBJECT,
        Due_Date: dueTomorrowInLondon((this.deps.now ?? (() => new Date()))()),
        Status: "Not Started",
        Who_Id: { id: leadId },
        Description: purchaseNoteContent(purchase),
      };
      // The lead's owner gets the task; an unassigned lead leaves Zoho's default owner.
      if (lead?.ownerId) fields.Owner = { id: lead.ownerId };
      const task = await this.deps.gateway.createRecord({ module: "Tasks", fields });
      this.assertOk(task, "convert_task_failed");
      await this.recordInLedger(CRM_ENTITY.task, recordId, "Tasks", task.recordId, purchase);
    }
  }

  private async recordInLedger(
    entityType: string,
    entityId: string,
    zohoModule: CrmModule,
    zohoRecordId: string,
    purchase: CrmPaidPurchase,
  ): Promise<void> {
    await this.deps.linkRepo.upsertLink({
      entityType,
      entityId,
      zohoModule,
      zohoRecordId,
      subjectId: purchase.subjectId,
    });
  }

  private assertOk(result: CrmRecordResult, fallbackCode: string): void {
    if (result.status === "success") return;
    throw new CrmGatewayError({
      code: result.code ?? fallbackCode,
      message: result.message ?? fallbackCode,
      status: 400,
      retryable: false,
    });
  }
}
