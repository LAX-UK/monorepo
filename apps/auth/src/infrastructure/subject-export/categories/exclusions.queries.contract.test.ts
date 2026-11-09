import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Pins what an Account reader may read. A mapper only sees the columns its query selected, so
 * keeping a column out of the query keeps it out of the file for good. These are the secrets and
 * staff notes Identity holds: a reader that names one fails here, so it cannot slip in later.
 */
const dir = dirname(fileURLToPath(import.meta.url));
const sources = readdirSync(dir)
  .filter((name) => name.endsWith(".category.ts"))
  .map((name) => ({ name, text: readFileSync(join(dir, name), "utf8") }));

const FORBIDDEN_TABLES = [
  "twoFactor", // secret and backup codes
  "verification", // one-time codes and email-change tokens
  "jwksKey", // signing keys
  "oauthAccessToken", // access and refresh tokens
  "oidcRpSession",
  "oidcBackchannelLogoutDelivery",
  "ssfStream",
  "ssfDelivery",
  "authSecurityEffectOutbox",
  "identityAccessMarker", // staff and organisation access, held for policy
  "identityMfaPolicy",
  "subjectDataExportAudit", // staff-facing audit rows, with other sessions' addresses
];

const FORBIDDEN_COLUMNS = [
  "account.password",
  "account.accessToken",
  "account.refreshToken",
  "account.idToken",
  "account.accountId", // the provider's own identifier for the person
  "account.scope",
  "twoFactor.secret",
  "twoFactor.backupCodes",
  "passkey.publicKey", // the key a passkey signs in with
  "passkey.credentialId", // identifies the credential to the authenticator
  "passkey.counter",
  "passkey.aaguid", // the authenticator model
  "passkey.transports",
  "session.token",
  "session.lastPasswordAuthAt",
  "session.mfaCompletedAt",
  "session.socialAuthAt",
  "session.lastStepUpAt",
  "oauthApplication.clientSecret",
  "oauthApplication.metadata",
  "oauthApplication.redirectUrls",
  "authKnownDevice.fingerprint", // a hash of the person's id and device label; used only as a key
  "user.identityDisabledReason", // a staff note
  "user.mergedIntoSubjectId", // another account
  "user.pendingNewEmail", // a half-confirmed address that may not be the person's
  "user.emailChangeExpiresAt",
  "subjectDataExport.objectKey",
  "subjectDataExport.sha256",
  "subjectDataExport.lastErrorCode",
  "identityLifecycleOutbox.actorUserId",
  "identityLifecycleOutbox.correlationId",
  "jwksKey.privateJwk",
  "jwksKey.publicJwk",
];

/**
 * Where a normally forbidden term is allowed, with the reason. The device fingerprint is the
 * device table's key: it orders and resumes pages and its first 16 characters make a record id.
 * The password column is read only as an "is set" test, which the next-but-one test pins.
 */
const ALLOWED: Record<string, { files: string[] }> = {
  "authKnownDevice.fingerprint": { files: ["sign-in-and-security.category.ts"] },
  "account.password": { files: ["sign-in-and-security.category.ts"] },
};

const strip = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const references = (text: string, term: string) =>
  new RegExp(`(?<![\\w.])${term.replace(".", "\\.")}(?![\\w])`).test(strip(text));

describe("Account subject export: what each reader may read", () => {
  it("finds the six category readers", () => {
    expect(sources.length).toBe(6);
  });

  it.each(FORBIDDEN_TABLES)("no reader reads %s", (table) => {
    for (const { name, text } of sources) {
      expect(references(text, table), `${name} references ${table}`).toBe(false);
    }
  });

  it.each(FORBIDDEN_COLUMNS)("no reader selects %s", (column) => {
    const allowed = ALLOWED[column]?.files ?? [];
    for (const { name, text } of sources) {
      if (allowed.includes(name)) continue;
      expect(references(text, column), `${name} references ${column}`).toBe(false);
    }
  });

  it("reads the password column only to say whether it is set", () => {
    for (const { name, text } of sources) {
      const uses = strip(text).match(/account\.password[^\n]*/g) ?? [];
      for (const use of uses) {
        expect(use, `${name}: ${use}`).toMatch(/^account\.password\} is not null`/);
      }
    }
  });

  it("selects named columns, never a whole row", () => {
    for (const { name, text } of sources) {
      expect((strip(text).match(/\.select\(\)/g) ?? []).length, name).toBe(0);
      expect(strip(text), name).not.toMatch(/\$inferSelect|select\(\s*getTableColumns/);
    }
  });

  it("reads lifecycle events by type, and only named fields of their payload", () => {
    for (const { name, text } of sources) {
      const code = strip(text);
      if (!code.includes("identityLifecycleOutbox")) continue;
      expect(code, name).toContain("inArray(identityLifecycleOutbox.eventType");
      expect(code, name).not.toMatch(/identityLifecycleOutbox\.payload\b(?!\}->>)/);
    }
  });
});
