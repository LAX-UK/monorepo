import {
  findSubjectExportCategory,
  subjectExportOriginSchema,
  subjectExportRecordSchema,
} from "@auction/identity-contracts";
import { describe, expect, it } from "vitest";
import { mapAddress } from "./addresses.category.js";
import { mapLegalAcceptance, mapProductAccess } from "./consents.category.js";
import { mapContact } from "./contact.category.js";
import { mapProfile } from "./profile.category.js";
import { mapDataDownload, mapDeletionRequests } from "./requests.category.js";
import {
  mapKnownDevice,
  mapNewDeviceNotice,
  mapPasswordMethod,
  mapSecurityEvent,
  mapSession,
  mapSocialMethod,
  mapTwoStep,
} from "./sign-in-and-security.category.js";

/**
 * Pins what each Account category may and may not contain. A mapper is handed a row that also
 * carries the columns that must never be exported (marked LEAK) and the output is checked three
 * ways: it holds no LEAK value, it uses only fields the shared contract documents, and every
 * record has an id and a valid origin. The query side is pinned in
 * `exclusions.queries.contract.test.ts`.
 */
const LEAK = "LEAK-must-not-appear";
const AT = new Date("2026-10-28T19:42:05Z");
const LATER = new Date("2026-10-30T08:00:00Z");

const forbidden = {
  password: LEAK,
  passwordHash: LEAK,
  secret: LEAK,
  backupCodes: LEAK,
  token: LEAK,
  accessToken: LEAK,
  refreshToken: LEAK,
  idToken: LEAK,
  publicKey: LEAK,
  privateJwk: LEAK,
  clientSecret: LEAK,
  identityDisabledReason: LEAK,
  mergedIntoSubjectId: LEAK,
  pendingNewEmail: LEAK,
  objectKey: LEAK,
  sha256: LEAK,
  lastErrorCode: LEAK,
  payload: LEAK,
  actorUserId: LEAK,
  lastPasswordAuthAt: AT,
};

type Case = { category: string; record: Record<string, unknown> };

const cases: Record<string, Case> = {
  profile: {
    category: "profile",
    record: mapProfile({
      id: "u1",
      name: "Sarah Whitfield",
      image: null,
      createdAt: AT,
      deletionRequestedAt: null,
      identityDisabledAt: AT,
      ...forbidden,
    } as never),
  },
  contact: {
    category: "contact",
    record: mapContact(
      {
        id: "u1",
        email: "sarah@example.com",
        emailVerified: true,
        phoneNumber: "+447700900123",
        phoneNumberVerified: true,
        ...forbidden,
      } as never,
      [
        { eventType: "user.registered", email: "old@example.com", occurredAt: AT },
        { eventType: "user.profile_updated", email: "sarah@example.com", occurredAt: LATER },
        { eventType: "user.email_verified", email: "sarah@example.com", occurredAt: LATER },
      ],
    ),
  },
  addresses: {
    category: "addresses",
    record: mapAddress({
      id: "a1",
      label: "Home",
      recipientName: "Sarah",
      phone: null,
      line1: "1 High Street",
      line2: null,
      city: "London",
      region: null,
      postcode: "N1 1AA",
      country: "GB",
      isDefaultShipping: true,
      isDefaultBilling: false,
      createdAt: AT,
      updatedAt: AT,
      subjectId: LEAK,
      version: 4,
    } as never),
  },
  password: {
    category: "sign-in-and-security",
    record: mapPasswordMethod({ passwordSet: true, changedAt: AT, ...forbidden } as never),
  },
  social: {
    category: "sign-in-and-security",
    record: mapSocialMethod({ id: "acc1", providerId: "google", createdAt: AT, ...forbidden }),
  },
  twoStep: { category: "sign-in-and-security", record: mapTwoStep(true) },
  session: {
    category: "sign-in-and-security",
    record: mapSession(
      {
        id: "s1",
        userAgent: "Mozilla/5.0 (Macintosh) AppleWebKit Chrome/120 Safari/537",
        ipAddress: "203.0.113.7",
        createdAt: AT,
        expiresAt: LATER,
        ...forbidden,
      } as never,
      AT,
    ),
  },
  device: {
    category: "sign-in-and-security",
    record: mapKnownDevice({
      fingerprint: "abcdef0123456789abcdef0123456789",
      firstSeenAt: AT,
      lastSeenAt: LATER,
    }),
  },
  notice: {
    category: "sign-in-and-security",
    record: mapNewDeviceNotice({ fingerprint: "abcdef0123456789abcdef", notifiedAt: AT }),
  },
  event: {
    category: "sign-in-and-security",
    record: mapSecurityEvent({
      id: 5,
      eventType: "user.credential_changed",
      changeType: "update",
      occurredAt: AT,
      ...forbidden,
    } as never),
  },
  consent: {
    category: "consents",
    record: mapProductAccess({
      id: "c1",
      product: "LAX Bid",
      scopes: "openid profile email",
      consentGiven: true,
      createdAt: AT,
      clientId: LEAK,
    } as never),
  },
  legalAcceptance: {
    category: "consents",
    record: mapLegalAcceptance({
      id: "a1",
      documentKind: "terms",
      documentVersion: "1.0",
      legalEntity: "london-art-exchange",
      product: "shop",
      acceptedAt: AT,
      subjectId: LEAK,
      source: LEAK,
    } as never),
  },
  download: {
    category: "requests",
    record: mapDataDownload({
      id: "e1",
      status: "ready",
      requestedAt: AT,
      readyAt: LATER,
      expiresAt: LATER,
      deletedAt: null,
      updatedAt: LATER,
      ...forbidden,
    } as never),
  },
  deletion: {
    category: "requests",
    record: (
      mapDeletionRequests([
        { id: 1, eventType: "user.deletion_requested", occurredAt: AT, ...forbidden },
        { id: 2, eventType: "user.deletion_cancelled", occurredAt: LATER, ...forbidden },
      ] as never)[0] as { record: Record<string, unknown> }
    ).record,
  },
};

describe("Account subject export: what each category may contain", () => {
  it.each(Object.entries(cases))("%s leaks nothing and uses documented fields", (_name, c) => {
    expect(JSON.stringify(c.record)).not.toContain(LEAK);
    expect(subjectExportRecordSchema.safeParse(c.record).success).toBe(true);
    expect(subjectExportOriginSchema.safeParse(c.record.origin).success).toBe(true);

    const definition = findSubjectExportCategory("account", c.category);
    expect(definition, c.category).toBeDefined();
    const documented = new Set(["id", "origin", ...(definition?.fields.map((f) => f.name) ?? [])]);
    expect(Object.keys(c.record).filter((key) => !documented.has(key))).toEqual([]);
    expect(definition?.origins).toContain(c.record.origin);
  });

  it("never returns a field named like a secret", () => {
    const names = Object.values(cases).flatMap((c) => Object.keys(c.record));
    for (const name of names) {
      expect(name).not.toMatch(/password(?!Set)|secret|backup|token|hash|credential|jwk|key/i);
    }
  });

  it("reports a password as set or not, with a date, and nothing else", () => {
    expect(mapPasswordMethod({ passwordSet: true, changedAt: AT } as never)).toEqual({
      id: "password",
      origin: "observed",
      kind: "sign_in_method",
      method: "password",
      methodName: null,
      passwordSet: true,
      changedAt: AT.toISOString(),
    });
    expect(mapPasswordMethod(null)).toMatchObject({ passwordSet: false, changedAt: null });
  });

  it("shortens the device hash to a record id and returns no label or address", () => {
    const record = cases.device?.record;
    expect(record?.id).toBe("device-abcdef0123456789");
    expect(record?.device).toBeNull();
  });

  it("states the profile status including pending deletion", () => {
    const base = { id: "u", name: "n", image: null, createdAt: AT, identityDisabledAt: null };
    expect(mapProfile({ ...base, deletionRequestedAt: AT }).status).toBe("pending_deletion");
    expect(mapProfile({ ...base, deletionRequestedAt: null }).status).toBe("active");
  });
});
