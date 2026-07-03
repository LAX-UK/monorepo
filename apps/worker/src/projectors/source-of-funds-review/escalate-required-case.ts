import { user } from "@auction/db/schema";
import type { IEmailService } from "@auction/email";
import { eq } from "drizzle-orm";
import { listComplianceRecipients } from "../../lib/compliance-email-recipients.js";
import type { Db } from "../lib/projector.types.js";
import type { SourceOfFundsRequiredPayload } from "./sof-review-helpers.js";

export async function escalateSourceOfFundsRequiredCase(args: {
  db: Db;
  emailService: IEmailService;
  supportContactEmail: string;
  adminReviewUrl: string;
  adminEmailAddress?: string | undefined;
  payload: SourceOfFundsRequiredPayload;
  sourceOfFundsId: string;
}): Promise<void> {
  const {
    db,
    emailService,
    supportContactEmail,
    adminReviewUrl,
    adminEmailAddress,
    payload,
    sourceOfFundsId,
  } = args;

  const detail =
    [
      payload.trigger ? `Trigger: ${payload.trigger}` : null,
      payload.exposureAmount
        ? `Exposure: ${payload.currency ?? ""} ${payload.exposureAmount}`.trim()
        : null,
    ]
      .filter(Boolean)
      .join(" · ") || "Source-of-Funds threshold crossed";
  const recipients = await listComplianceRecipients(db);
  if (recipients.length > 0) {
    for (const r of recipients) {
      await emailService.enqueue({
        template: "aml-compliance-review-notice",
        to: r.email,
        userId: r.id,
        vars: {
          recipientFirstName: r.firstName,
          kind: "source_of_funds",
          caseReference: sourceOfFundsId,
          detail,
          adminReviewUrl,
          supportContactEmail,
        },
        category: "transactional",
        idempotencyKey: `aml-compliance-review-notice:sof:${sourceOfFundsId}:${r.id}`,
      });
    }
  } else if (adminEmailAddress) {
    await emailService.enqueue({
      template: "aml-compliance-review-notice",
      to: adminEmailAddress,
      recipientResolution: "snapshot",
      vars: {
        recipientFirstName: "Compliance",
        kind: "source_of_funds",
        caseReference: sourceOfFundsId,
        detail,
        adminReviewUrl,
        supportContactEmail,
      },
      category: "transactional",
      idempotencyKey: `aml-compliance-review-notice:sof:${sourceOfFundsId}:admin`,
    });
  }

  const buyerId = payload.userId;
  if (buyerId) {
    const [buyerRow] = await db
      .select({ email: user.email, firstName: user.firstName })
      .from(user)
      .where(eq(user.id, buyerId))
      .limit(1);
    if (buyerRow?.email) {
      await emailService.enqueue({
        template: "source-of-funds-buyer-notice",
        to: buyerRow.email,
        userId: buyerId,
        vars: {
          userName: buyerRow.firstName ?? null,
          supportContactEmail,
        },
        category: "transactional",
        idempotencyKey: `source-of-funds-buyer-notice:${sourceOfFundsId}`,
      });
    }
  }
}
