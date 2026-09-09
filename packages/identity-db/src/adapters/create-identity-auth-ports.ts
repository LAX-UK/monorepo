import type { ConsentStore } from "@auction/identity-contracts";
import type { Jwk } from "better-auth/plugins/jwt";
import { createDrizzleAccountLinkReader } from "./drizzle-account-link-reader.js";
import { createDrizzleConsentStore } from "./drizzle-consent-store.js";
import type { IdentityDatabase } from "./drizzle-consent-store.js";
import { createDrizzleJwksStore } from "./drizzle-jwks-store.js";
import { createDrizzlePhoneNumberStore } from "./drizzle-phone-number-store.js";
import { createDrizzleSessionCountReader } from "./drizzle-session-count-reader.js";
import { createDrizzleSessionStampStore } from "./drizzle-session-stamp-store.js";
import { createDrizzleSubjectStatusReader } from "./drizzle-subject-status-reader.js";
import type { EnvelopeCrypto } from "./envelope.js";

export type IdentityAuthPorts = {
  consentStore: ConsentStore;
  jwksStore: ReturnType<typeof createDrizzleJwksStore>;
  sessionStampStore: ReturnType<typeof createDrizzleSessionStampStore>;
  subjectStatusReader: ReturnType<typeof createDrizzleSubjectStatusReader>;
  accountLinkReader: ReturnType<typeof createDrizzleAccountLinkReader>;
  sessionCountReader: ReturnType<typeof createDrizzleSessionCountReader>;
  phoneNumberStore: ReturnType<typeof createDrizzlePhoneNumberStore>;
};

export function createIdentityAuthPorts(
  db: IdentityDatabase,
  options?: { envelope?: EnvelopeCrypto | undefined; consentStore?: ConsentStore },
): IdentityAuthPorts {
  return {
    consentStore: options?.consentStore ?? createDrizzleConsentStore(db),
    jwksStore: createDrizzleJwksStore(db, options?.envelope),
    sessionStampStore: createDrizzleSessionStampStore(db),
    subjectStatusReader: createDrizzleSubjectStatusReader(db),
    accountLinkReader: createDrizzleAccountLinkReader(db),
    sessionCountReader: createDrizzleSessionCountReader(db),
    phoneNumberStore: createDrizzlePhoneNumberStore(db),
  };
}

/** @deprecated use jwksStore via createIdentityAuthPorts */
export { jwksKey } from "../schema/jwks-key.js";
export type { Jwk };
