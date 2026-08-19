import { describe, expect, it } from "vitest";
import type {
  AccountLinkReader,
  AuthPorts,
  ConsentStore,
  EmailSender,
  IdentityEventPublisher,
  JwksStore,
  PhoneNumberStore,
  ProductSubjectUsageProbe,
  SessionCountReader,
  SessionStampStore,
  SmsSender,
  SubjectStatusReader,
} from "./index.js";

type MethodNames<T> = {
  [K in keyof T]: T[K] extends (...args: never[]) => unknown ? K : never;
}[keyof T];

function expectMethods<T extends object>(label: string, sample: T, methods: MethodNames<T>[]) {
  it(`defines ${label} with ${methods.join(", ")}`, () => {
    for (const method of methods) {
      expect(typeof sample[method]).toBe("function");
    }
  });
}

describe("identity port surface contract", () => {
  const consentStore: ConsentStore = {
    upsert: async (input) => input,
  };
  const emailSender: EmailSender = {
    enqueue: async () => ({ outboxId: "outbox-1" }),
  };
  const smsSender: SmsSender = {
    isConfigured: () => true,
    sendOtp: async () => ({ sid: "sms-1" }),
    checkOtp: async () => ({ valid: true }),
  };
  const subjectStatusReader: SubjectStatusReader = {
    isDisabledOrMerged: async () => false,
  };
  const sessionStampStore: SessionStampStore = {
    stampPasswordAuth: async () => {},
    stampMfaCompleted: async () => {},
  };
  const accountLinkReader: AccountLinkReader = {
    countAccountsForUser: async () => 1,
    isEmailVerified: async () => true,
    findUserEmailProfile: async () => null,
  };
  const sessionCountReader: SessionCountReader = {
    countSessionsForUser: async () => 0,
  };
  const jwksStore: JwksStore = {
    getJwks: async () => [],
    getActiveSigningJwk: async () => null,
    createJwk: async (data) => ({ ...data, id: "kid-1" }),
    getPublicJwks: async () => ({ keys: [] }),
    markKeyRetired: async () => {},
  };
  const identityEventPublisher: IdentityEventPublisher = {
    publish: async () => {},
  };
  const productSubjectUsageProbe: ProductSubjectUsageProbe = {
    hasProductProfile: async () => false,
    hasExternalLink: async () => false,
  };
  const phoneNumberStore: PhoneNumberStore = {
    purgeExpiredVerifications: async () => {},
    findPhoneNumber: async () => null,
    resetPhoneVerifiedIfNumberChanged: async () => {},
  };
  const authPorts: AuthPorts = {
    consentStore,
    jwksStore,
    sessionStampStore,
    subjectStatusReader,
    accountLinkReader,
    sessionCountReader,
    phoneNumberStore,
    email: emailSender,
    sms: smsSender,
    events: identityEventPublisher,
  };

  expectMethods("ConsentStore", consentStore, ["upsert"]);
  expectMethods("EmailSender", emailSender, ["enqueue"]);
  expectMethods("SmsSender", smsSender, ["isConfigured", "sendOtp", "checkOtp"]);
  expectMethods("SubjectStatusReader", subjectStatusReader, ["isDisabledOrMerged"]);
  expectMethods("SessionStampStore", sessionStampStore, ["stampPasswordAuth", "stampMfaCompleted"]);
  expectMethods("AccountLinkReader", accountLinkReader, [
    "countAccountsForUser",
    "isEmailVerified",
    "findUserEmailProfile",
  ]);
  expectMethods("SessionCountReader", sessionCountReader, ["countSessionsForUser"]);
  expectMethods("JwksStore", jwksStore, [
    "getJwks",
    "getActiveSigningJwk",
    "createJwk",
    "getPublicJwks",
    "markKeyRetired",
  ]);
  expectMethods("PhoneNumberStore", phoneNumberStore, [
    "purgeExpiredVerifications",
    "findPhoneNumber",
    "resetPhoneVerifiedIfNumberChanged",
  ]);
  expectMethods("IdentityEventPublisher", identityEventPublisher, ["publish"]);
  expectMethods("ProductSubjectUsageProbe", productSubjectUsageProbe, [
    "hasProductProfile",
    "hasExternalLink",
  ]);

  it("exports AuthPorts with the composition-root wiring keys", () => {
    expect(Object.keys(authPorts).sort()).toEqual([
      "accountLinkReader",
      "consentStore",
      "email",
      "events",
      "jwksStore",
      "phoneNumberStore",
      "sessionCountReader",
      "sessionStampStore",
      "sms",
      "subjectStatusReader",
    ]);
  });
});
