import type {
  IdentityEventPublisher,
  ProductSubjectUsageProbe,
  SecurityNoticePublisher,
} from "@auction/auth";
import type { IdentityDatabase } from "@auction/identity-db";
import { DrizzleIdentityCredentialRepository } from "../infrastructure/drizzle-identity-credential-repository.js";
import { DrizzleIdentityEmailChangeRepository } from "../infrastructure/drizzle-identity-email-change-repository.js";
import { DrizzleIdentitySessionRepository } from "../infrastructure/drizzle-identity-session-repository.js";
import { DrizzleIdentitySubjectRepository } from "../infrastructure/drizzle-identity-subject-repository.js";
import { DrizzleIdentityUnitOfWork } from "../infrastructure/drizzle-identity-unit-of-work.js";
import { DrizzleIdentityVerificationPurger } from "../infrastructure/drizzle-identity-verification-purger.js";
import { EmailIdentityNotifier } from "../infrastructure/email-identity-notifier.js";
import { HibpRangeBreachedPasswordChecker } from "../infrastructure/hibp-range-breached-password-checker.js";
import type { BackchannelLogoutService } from "../services/backchannel-logout.service.js";
import { IdentityOperationsService } from "../services/identity-operations.service.js";

export function createIdentityOperationsService(options: {
  db: IdentityDatabase;
  notices: SecurityNoticePublisher;
  productSubjectUsage: ProductSubjectUsageProbe;
  identityEventPublisher: IdentityEventPublisher;
  /** Opens the address a provider reported, which is stored sealed. Null when sealing is off. */
  envelope?: { open(sealed: string): string } | null | undefined;
  logout?: Pick<BackchannelLogoutService, "revokeIdentitySessions" | "revokeSubject">;
}) {
  const db = options.db;
  return new IdentityOperationsService(
    {
      unitOfWork: new DrizzleIdentityUnitOfWork(db),
      subjects: new DrizzleIdentitySubjectRepository(db),
      credentials: new DrizzleIdentityCredentialRepository(db, options.envelope ?? null),
      sessions: new DrizzleIdentitySessionRepository(db),
      emailChanges: new DrizzleIdentityEmailChangeRepository(db),
      verifications: new DrizzleIdentityVerificationPurger(db),
    },
    new EmailIdentityNotifier(options.notices),
    options.productSubjectUsage,
    options.identityEventPublisher,
    options.logout,
    undefined,
    new HibpRangeBreachedPasswordChecker(),
  );
}
