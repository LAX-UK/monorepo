import type { Database } from "@auction/db";
import { legalEntity, legalEntityMember, user } from "@auction/db/schema";
import type { IEmailService, TemplateVarsByName } from "@auction/email";
import { and, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";

const NOTIFY_ROLES = ["owner", "admin"] as const;

export async function enqueueOrgLifecycleMemberEmails(args: {
  db: Database;
  emailService: IEmailService;
  legalEntityId: string;
  template:
    | "legal-entity-approved-notice"
    | "legal-entity-rejected-notice"
    | "legal-entity-docs-requested-notice";
  vars: Record<string, string | null | undefined>;
  idempotencyPrefix: string;
}): Promise<void> {
  const [entityRow] = await args.db
    .select({ displayName: legalEntity.displayName })
    .from(legalEntity)
    .where(eq(legalEntity.id, args.legalEntityId))
    .limit(1);
  const entityName = entityRow?.displayName ?? "Organisation";

  const members = await args.db
    .selectDistinct({
      email: user.email,
      userId: user.id,
      firstName: user.firstName,
    })
    .from(legalEntityMember)
    .innerJoin(user, eq(user.id, legalEntityMember.userId))
    .where(
      and(
        eq(legalEntityMember.legalEntityId, args.legalEntityId),
        isNull(legalEntityMember.removedAt),
        isNotNull(legalEntityMember.acceptedAt),
        or(
          inArray(legalEntityMember.role, [...NOTIFY_ROLES]),
          eq(legalEntityMember.isPrimaryAdmin, true),
        ),
      ),
    );

  for (const m of members) {
    await args.emailService.enqueue({
      template: args.template,
      to: m.email,
      userId: m.userId,
      vars: {
        recipientFirstName: m.firstName,
        entityName,
        legalEntityId: args.legalEntityId,
        ...args.vars,
      } as TemplateVarsByName[typeof args.template],
      category: "transactional",
      idempotencyKey: `${args.idempotencyPrefix}:${args.legalEntityId}:${m.userId}`,
    });
  }
}

export async function enqueueOrgSubmittedAdminNotice(args: {
  db: Database;
  emailService: IEmailService;
  legalEntityId: string;
  entityDisplayName: string;
  adminRecipients: string[];
  adminOnboardingUrl: string;
  supportContactEmail: string;
  eventId: number;
}): Promise<void> {
  for (const to of args.adminRecipients) {
    await args.emailService.enqueue({
      template: "legal-entity-submitted-admin-notice",
      to,
      vars: {
        entityName: args.entityDisplayName,
        legalEntityId: args.legalEntityId,
        adminOnboardingUrl: args.adminOnboardingUrl,
        supportContactEmail: args.supportContactEmail,
      },
      category: "transactional",
      idempotencyKey: `legal-entity-submitted-admin:${args.eventId}:${to}`,
    });
  }
}
