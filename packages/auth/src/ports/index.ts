export type { ConsentRecord, ConsentStore } from "./consent-store.js";
export type { EmailEnqueueInput, EmailSender } from "./email-sender.js";
export type { SmsSender } from "./sms-sender.js";
export type { SubjectStatusReader } from "./subject-status-reader.js";
export type { SessionStampStore } from "./session-stamp-store.js";
export type { AccountLinkReader } from "./account-link-reader.js";
export type { SessionCountReader } from "./session-count-reader.js";
export type { JwksStore } from "./jwks-store.js";
export type {
  IdentityEventPublisher,
  IdentityLifecycleEvent,
} from "./identity-event-publisher.js";
export type { ProductSubjectUsageProbe } from "./product-subject-usage-probe.js";
export type { PhoneNumberStore } from "./phone-number-store.js";

export type AuthPorts = {
  consentStore: import("./consent-store.js").ConsentStore;
  jwksStore: import("./jwks-store.js").JwksStore;
  sessionStampStore: import("./session-stamp-store.js").SessionStampStore;
  subjectStatusReader: import("./subject-status-reader.js").SubjectStatusReader;
  accountLinkReader: import("./account-link-reader.js").AccountLinkReader;
  sessionCountReader: import("./session-count-reader.js").SessionCountReader;
  phoneNumberStore: import("./phone-number-store.js").PhoneNumberStore;
  email: import("./email-sender.js").EmailSender | undefined;
  sms: import("./sms-sender.js").SmsSender | undefined;
  events: import("./identity-event-publisher.js").IdentityEventPublisher | undefined;
};
