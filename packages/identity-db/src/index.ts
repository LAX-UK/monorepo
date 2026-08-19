export {
  closeIdentityDb,
  createIdentityDb,
  getIdentityPool,
  type IdentityDb,
} from "./client.js";
export type { IdentityDatabase } from "./adapters/drizzle-consent-store.js";
export { createDrizzleConsentStore } from "./adapters/drizzle-consent-store.js";
export {
  createIdentityAuthPorts,
  type IdentityAuthPorts,
} from "./adapters/create-identity-auth-ports.js";
export { createDrizzleJwksStore } from "./adapters/drizzle-jwks-store.js";
export { createDrizzleSessionStampStore } from "./adapters/drizzle-session-stamp-store.js";
export { createDrizzleAccountLinkReader } from "./adapters/drizzle-account-link-reader.js";
export { createDrizzleSubjectStatusReader } from "./adapters/drizzle-subject-status-reader.js";
export { createDrizzleSessionCountReader } from "./adapters/drizzle-session-count-reader.js";
export { createDrizzlePhoneNumberStore } from "./adapters/drizzle-phone-number-store.js";
export {
  createDrizzleIdentityOutboxPublisher,
  type IdentityOutboxLifecycleEvent,
  type IdentityOutboxPublisher,
} from "./adapters/drizzle-identity-outbox-publisher.js";
export {
  retireExpiredJwksKeys,
  startJwksRetirementSchedule,
} from "./adapters/drizzle-jwks-retirement.js";
export type { EnvelopeCrypto } from "./adapters/envelope.js";
export type { ConsentRecord, ConsentStore } from "./ports/consent-store.js";
export * from "./schema/index.js";
