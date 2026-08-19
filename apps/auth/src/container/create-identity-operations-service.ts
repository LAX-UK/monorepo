import type { IdentityEventPublisher, ProductSubjectUsageProbe } from "@auction/auth";
import type { IEmailService } from "@auction/email";
import type { IdentityDatabase } from "@auction/identity-db";
import { DrizzleIdentityCredentialRepository } from "../infrastructure/drizzle-identity-credential-repository.js";
import { DrizzleIdentityEmailChangeRepository } from "../infrastructure/drizzle-identity-email-change-repository.js";
import { DrizzleIdentitySessionRepository } from "../infrastructure/drizzle-identity-session-repository.js";
import { DrizzleIdentitySubjectRepository } from "../infrastructure/drizzle-identity-subject-repository.js";
import { DrizzleIdentityUnitOfWork } from "../infrastructure/drizzle-identity-unit-of-work.js";
import { DrizzleIdentityVerificationPurger } from "../infrastructure/drizzle-identity-verification-purger.js";
import { EmailIdentityNotifier } from "../infrastructure/email-identity-notifier.js";
import type { BackchannelLogoutService } from "../services/backchannel-logout.service.js";
import { IdentityOperationsService } from "../services/identity-operations.service.js";

export function createIdentityOperationsService(options: {
  db: IdentityDatabase;
  email: Pick<IEmailService, "enqueue">;
  productSubjectUsage: ProductSubjectUsageProbe;
  identityEventPublisher: IdentityEventPublisher;
  logout?: Pick<BackchannelLogoutService, "revokeIdentitySessions" | "revokeSubject">;
}) {
  const db = options.db;
  return new IdentityOperationsService(
    {
      unitOfWork: new DrizzleIdentityUnitOfWork(db),
      subjects: new DrizzleIdentitySubjectRepository(db),
      credentials: new DrizzleIdentityCredentialRepository(db),
      sessions: new DrizzleIdentitySessionRepository(db),
      emailChanges: new DrizzleIdentityEmailChangeRepository(db),
      verifications: new DrizzleIdentityVerificationPurger(db),
    },
    new EmailIdentityNotifier(options.email),
    options.productSubjectUsage,
    options.identityEventPublisher,
    options.logout,
  );
}
