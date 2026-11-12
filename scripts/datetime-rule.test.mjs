import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { bannedConstructsIn, isScanned } from "./datetime-rule.mjs";

const fixture = (name) =>
  readFile(path.join(import.meta.dirname, "datetime-rule.fixtures", name), "utf8");

test("rejects a new Intl.DateTimeFormat, with or without new", async () => {
  const text = await fixture("intl-formatter.txt");
  assert.deepEqual(bannedConstructsIn("apps/web/src/lib/new-file.ts", text), [
    "Intl.DateTimeFormat",
  ]);
  assert.deepEqual(
    bannedConstructsIn("apps/web/src/a.ts", 'const f = Intl.DateTimeFormat("en-GB");'),
    ["Intl.DateTimeFormat"],
  );
});

test("rejects the toLocale family", async () => {
  const text = await fixture("to-locale.txt");
  assert.deepEqual(bannedConstructsIn("apps/api/src/new-file.ts", text), [
    "toLocale(Date|Time)String",
  ]);
  assert.deepEqual(bannedConstructsIn("apps/api/src/a.ts", "const t = d.toLocaleTimeString();"), [
    "toLocale(Date|Time)String",
  ]);
});

test("lets number formatting through toLocaleString, and catches it on a date", () => {
  const rule = (code) => bannedConstructsIn("apps/web/src/a.ts", code);
  assert.deepEqual(
    rule('const n = (1234.5).toLocaleString("en-GB", { maximumFractionDigits: 2 });'),
    [],
  );
  assert.deepEqual(
    rule('const p = price.toLocaleString("en-GB", { style: "currency", currency: "GBP" });'),
    [],
  );
  assert.deepEqual(rule("const n = count.toLocaleString();"), []);
  const banned = ["toLocale(Date|Time)String"];
  assert.deepEqual(rule("const s = new Date(x).toLocaleString();"), banned);
  assert.deepEqual(rule("const s = closesAt.toLocaleString();"), banned);
  assert.deepEqual(rule('const s = x.toLocaleString("en-GB", { timeZone: "UTC" });'), banned);
  assert.deepEqual(rule('const s = x.toLocaleString("en-GB", { dateStyle: "long" });'), banned);
  assert.deepEqual(rule("const s = x.toLocaleDateString();"), banned);
});

test("rejects importing @date-fns/tz in every spelling", async () => {
  const text = await fixture("date-fns-tz.txt");
  assert.deepEqual(bannedConstructsIn("packages/ui/src/new-file.ts", text), ["@date-fns/tz"]);
  assert.deepEqual(
    bannedConstructsIn("apps/web/src/a.ts", 'const tz = await import("@date-fns/tz");'),
    ["@date-fns/tz"],
  );
  assert.deepEqual(bannedConstructsIn("apps/web/src/a.ts", 'import "@date-fns/tz";'), [
    "@date-fns/tz",
  ]);
});

test("reports every construct a file uses, sorted", async () => {
  const text = `${await fixture("to-locale.txt")}\n${await fixture("intl-formatter.txt")}`;
  assert.deepEqual(bannedConstructsIn("apps/web/src/a.ts", text), [
    "Intl.DateTimeFormat",
    "toLocale(Date|Time)String",
  ]);
});

test("passes the module itself", async () => {
  const text = await fixture("intl-formatter.txt");
  assert.deepEqual(bannedConstructsIn("packages/datetime/src/zone-formats.ts", text), []);
  assert.equal(isScanned("packages/datetime/src/index.ts"), false);
});

test("passes code that formats through the module, and prose that mentions the banned calls", async () => {
  const text = await fixture("clean.txt");
  assert.deepEqual(bannedConstructsIn("apps/web/src/a.ts", text), []);
});

test("leaves tests alone", async () => {
  const text = await fixture("intl-formatter.txt");
  assert.deepEqual(bannedConstructsIn("apps/web/src/a.test.tsx", text), []);
  assert.deepEqual(bannedConstructsIn("apps/web/e2e/a.ts", text), []);
  assert.deepEqual(bannedConstructsIn("packages/ui/src/__tests__/a.ts", text), []);
});

test("does not mistake Intl types or other Intl formatters for the banned call", () => {
  const text = [
    "let options: Intl.DateTimeFormatOptions;",
    "let f: Intl.DateTimeFormat;",
    'const n = new Intl.NumberFormat("en-GB");',
  ].join("\n");
  assert.deepEqual(bannedConstructsIn("apps/web/src/a.ts", text), []);
});
