import type { EmailSender } from "@auction/auth";
import type { IdentityDatabase } from "@auction/identity-db";
import { DrizzleIdentitySubjectRepository } from "../infrastructure/drizzle-identity-subject-repository.js";
import { DrizzleKnownDeviceStore } from "../infrastructure/drizzle-known-device.store.js";
import { DrizzleSecurityEffectOutboxRepository } from "../infrastructure/drizzle-security-effect-outbox.repository.js";
import {
  DurableSecurityEffects,
  type SecurityEffectPorts,
} from "../services/durable-security-effects.js";
import { SecurityNoticeService } from "../services/security-notice.service.js";
import type { SecurityEffectLogger } from "../services/settle-security-effect.js";

export function createSecurityNoticeService(options: {
  db: IdentityDatabase;
  email: EmailSender;
  secureAccountUrl: string;
  cancelDeletionUrl: string;
  log: SecurityEffectLogger;
}): SecurityNoticeService {
  return new SecurityNoticeService({
    subjects: new DrizzleIdentitySubjectRepository(options.db),
    email: options.email,
    devices: new DrizzleKnownDeviceStore(options.db),
    secureAccountUrl: options.secureAccountUrl,
    cancelDeletionUrl: options.cancelDeletionUrl,
    log: options.log,
  });
}

export function createDurableSecurityEffects(options: {
  db: IdentityDatabase;
  ports: SecurityEffectPorts;
  log: SecurityEffectLogger;
}): DurableSecurityEffects {
  return new DurableSecurityEffects(
    new DrizzleSecurityEffectOutboxRepository(options.db),
    options.ports,
    options.log,
  );
}
