import type { IEmailService, TemplateVarsByName } from "@auction/email";
import type { ILegalEntityMemberRepository } from "@auction/persistence";
import type { ILegalEntityRepository } from "../services/interfaces/legal-entity-repository.js";

const NOTIFY_ROLES = new Set(["owner", "admin"]);

export async function enqueueOrgLifecycleMemberEmails(args: {
  legalEntityRepository: ILegalEntityRepository;
  memberRepository: ILegalEntityMemberRepository;
  emailService: IEmailService;
  legalEntityId: string;
  template:
    | "legal-entity-approved-notice"
    | "legal-entity-rejected-notice"
    | "legal-entity-docs-requested-notice";
  vars: Record<string, string | null | undefined>;
  idempotencyPrefix: string;
}): Promise<void> {
  const entity = await args.legalEntityRepository.findById(args.legalEntityId);
  const entityName = entity?.displayName ?? "Organisation";

  const members = await args.memberRepository.listMembersWithUsers(args.legalEntityId);
  const recipients = members.filter(
    (m) => !m.removedAt && m.acceptedAt && (NOTIFY_ROLES.has(m.role) || m.isPrimaryAdmin),
  );

  for (const m of recipients) {
    await args.emailService.enqueue({
      template: args.template,
      to: m.user.email,
      userId: m.userId,
      vars: {
        recipientFirstName: m.user.name.split(" ")[0] ?? m.user.name,
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
