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
const categorySources = readdirSync(dir)
  .filter((name) => name.endsWith(".category.ts"))
  .map((name) => ({ name, text: readFileSync(join(dir, name), "utf8") }));

/**
 * Readers that live outside `categories/` but whose rows reach the file: they are injected into a
 * category by the registry. Each is held to every rule below, as a category is. The registry test
 * further down fails if the registry injects a reader that is not listed here.
 */
const SUPPORTING_READERS = ["drizzle-session-clients.reader.ts"] as const;
const infrastructureDir = join(dir, "..", "..");
const supportingSources = SUPPORTING_READERS.map((name) => ({
  name,
  text: readFileSync(join(infrastructureDir, name), "utf8"),
}));
const sources = [...categorySources, ...supportingSources];

const FORBIDDEN_TABLES = [
  "twoFactor", // secret and backup codes
  "verification", // one-time codes and email-change tokens
  "jwksKey", // signing keys
  "oauthAccessToken", // access and refresh tokens; see TOKEN_TABLE_ALLOWANCE for the one exception
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
  oauthAccessToken: { files: ["drizzle-session-clients.reader.ts"] },
};

/**
 * The one reader allowed to touch the token table, and exactly what it may name there. It says
 * which products each of the person's browsers was used for, so it needs the sign-in id a token
 * was issued under (`sid`), the product (`clientId`) and the person filter (`userId`). Nothing
 * else: no token value, no token row id, no scopes, no expiry. The table itself may appear only as
 * `.from(oauthAccessToken)`, so it can never be selected whole.
 */
const TOKEN_TABLE_ALLOWANCE = {
  file: "drizzle-session-clients.reader.ts",
  columns: ["sid", "clientId", "userId"],
} as const;

/** Every way the token-table rule is broken in a source, empty when it is kept. */
function tokenTableViolations(text: string): string[] {
  const code = strip(text);
  const violations: string[] = [];
  for (const [, column] of code.matchAll(/(?<![\w.])oauthAccessToken\.(\w+)/g)) {
    if (!(TOKEN_TABLE_ALLOWANCE.columns as readonly string[]).includes(column ?? "")) {
      violations.push(`names oauthAccessToken.${column}`);
    }
  }
  const bare = code.match(/(?<![\w.])oauthAccessToken(?![\w.])/g) ?? [];
  const asSource = code.match(/\.from\(\s*oauthAccessToken\s*\)/g) ?? [];
  const imports = code.match(/import\s*\{[^}]*\boauthAccessToken\b[^}]*\}/g) ?? [];
  if (bare.length !== asSource.length + imports.length) {
    violations.push("uses oauthAccessToken other than in .from(oauthAccessToken)");
  }
  if (/\.select(?:Distinct)?\(\s*\)/.test(code)) violations.push("selects a whole row");
  if (/access_token|refresh_token/.test(code)) violations.push("names a token column in SQL");
  return violations;
}

const strip = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const references = (text: string, term: string) =>
  new RegExp(`(?<![\\w.])${term.replace(".", "\\.")}(?![\\w])`).test(strip(text));

describe("Account subject export: what each reader may read", () => {
  it("finds the six category readers and the supporting readers", () => {
    expect(categorySources.length).toBe(6);
    expect(supportingSources.map((source) => source.name)).toEqual([...SUPPORTING_READERS]);
  });

  it("covers every reader the registry injects into a category", () => {
    const registry = readFileSync(
      join(dir, "..", "create-account-subject-export-categories.ts"),
      "utf8",
    );
    const injected = [...strip(registry).matchAll(/from "\.\.\/([\w.-]+)\.js"/g)].map(
      ([, name]) => `${name}.ts`,
    );
    expect(injected).toContain("drizzle-session-clients.reader.ts");
    for (const name of injected) {
      expect(
        SUPPORTING_READERS as readonly string[],
        `${name} is not under the contract`,
      ).toContain(name);
    }
  });

  it.each(FORBIDDEN_TABLES)("no reader reads %s", (table) => {
    const allowed = ALLOWED[table]?.files ?? [];
    for (const { name, text } of sources) {
      if (allowed.includes(name)) continue;
      expect(references(text, table), `${name} references ${table}`).toBe(false);
    }
  });

  it("reads only the sign-in id, product and person of a token, never a token value", () => {
    const reader = sources.find((source) => source.name === TOKEN_TABLE_ALLOWANCE.file);
    expect(reader).toBeDefined();
    expect(tokenTableViolations(reader?.text ?? "")).toEqual([]);
  });

  it("would fail the reader if it selected a token value or a whole token row", () => {
    const text = sources.find((source) => source.name === TOKEN_TABLE_ALLOWANCE.file)?.text ?? "";
    const fields = "{ sid: oauthAccessToken.sid, clientId: oauthAccessToken.clientId }";
    expect(text).toContain(fields);
    const mutations = [
      fields.replace(" }", ", accessToken: oauthAccessToken.accessToken }"),
      fields.replace(" }", ", refreshToken: oauthAccessToken.refreshToken }"),
      fields.replace(" }", ", id: oauthAccessToken.id }"),
      "{ token: oauthAccessToken }",
      ")",
      "{ value: sql`access_token` }",
    ];
    for (const mutation of mutations) {
      const mutated =
        mutation === ")"
          ? text.replace(`.selectDistinct(${fields})`, ".selectDistinct()")
          : text.replace(fields, mutation);
      expect(mutated, mutation).not.toBe(text);
      expect(tokenTableViolations(mutated), mutation).not.toEqual([]);
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
