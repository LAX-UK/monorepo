import type { IEmailService, TemplateVarsByName } from "@auction/email";
import type { ILegalEntityMemberRepository } from "@auction/persistence/interfaces";
import type { ILegalEntityRepository } from "@auction/persistence/interfaces";

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

/**
 * Tells each staff member who can review accounts that one was submitted. The notice goes to the
 * person's account (the address is read when it is sent) and is keyed by the submission and their
 * account id, so sending it again for the same submission changes nothing and no address is kept
 * in the key.
 */
export async function enqueueOrgSubmittedAdminNotice(args: {
  emailService: IEmailService;
  legalEntityId: string;
  entityDisplayName: string;
  adminRecipients: { userId: string; email: string }[];
  adminOnboardingUrl: string;
  supportContactEmail: string;
  /** Names one submission of the account, so a resubmission after changes is a new notice. */
  submissionId: string;
}): Promise<void> {
  for (const { userId, email } of args.adminRecipients) {
    await args.emailService.enqueue({
      template: "legal-entity-submitted-admin-notice",
      to: email,
      userId,
      vars: {
        entityName: args.entityDisplayName,
        legalEntityId: args.legalEntityId,
        adminOnboardingUrl: args.adminOnboardingUrl,
        supportContactEmail: args.supportContactEmail,
      },
      category: "transactional",
      idempotencyKey: `legal-entity-submitted-admin:${args.submissionId}:${userId}`,
    });
  }
}
