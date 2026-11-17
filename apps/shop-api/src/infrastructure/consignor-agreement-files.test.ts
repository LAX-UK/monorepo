import { describe, expect, it } from "vitest";
import { createFakeObjectStorage } from "../test-support/fake-object-storage.js";
import {
  agreementFilePrefix,
  createConsignorAgreementFiles,
  matchesAgreementFileType,
} from "./consignor-agreement-files.js";

const PARTY = "22222222-2222-4222-8222-222222222222";
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const PDF = Buffer.from("%PDF-1.4\n");

describe("signed agreement files", () => {
  it("knows a PDF, a JPEG and a PNG by their first bytes", () => {
    expect(matchesAgreementFileType("application/pdf", PDF)).toBe(true);
    expect(matchesAgreementFileType("image/jpeg", JPEG)).toBe(true);
    expect(matchesAgreementFileType("image/png", PNG)).toBe(true);
    expect(matchesAgreementFileType("application/pdf", PNG)).toBe(false);
    expect(matchesAgreementFileType("image/png", PDF)).toBe(false);
  });

  it("keeps each client's files under a private prefix of their own, outside shop/", async () => {
    const files = createConsignorAgreementFiles(createFakeObjectStorage());
    const upload = await files.createUpload({
      partyId: PARTY,
      contentType: "image/png",
      byteSize: 12,
    });
    expect(upload.key).toMatch(new RegExp(`^${agreementFilePrefix(PARTY)}[0-9a-f-]{36}\\.png$`));
    expect(upload.requiredHeaders).toEqual({ "content-type": "image/png" });
  });

  it("checks the stored file: there, this client's, an allowed type, not too large", async () => {
    const storage = createFakeObjectStorage();
    const files = createConsignorAgreementFiles(storage);
    const put = (name: string, body: Buffer, contentType: string) => {
      const key = `${agreementFilePrefix(PARTY)}${name}`;
      storage.objects.set(key, { body, contentType });
      return key;
    };
    const check = (key: string) => files.check({ partyId: PARTY, key });
    expect(await check(put("a.pdf", PDF, "application/pdf"))).toEqual({ ok: true });
    expect(await check(`${agreementFilePrefix(PARTY)}never.pdf`)).toEqual({
      ok: false,
      reason: "missing",
    });
    expect(await check("shop/artwork/a.pdf")).toEqual({ ok: false, reason: "not_this_client" });
    expect(await check(put("b.gif", PDF, "image/gif"))).toEqual({
      ok: false,
      reason: "wrong_type",
    });
    expect(await check(put("c.pdf", PNG, "application/pdf"))).toEqual({
      ok: false,
      reason: "wrong_type",
    });
    expect(
      await check(
        put("d.pdf", Buffer.concat([PDF, Buffer.alloc(20 * 1024 * 1024)]), "application/pdf"),
      ),
    ).toEqual({ ok: false, reason: "too_large" });
  });

  it("signs a download that saves under the given name", async () => {
    const storage = createFakeObjectStorage();
    const calls: unknown[] = [];
    const files = createConsignorAgreementFiles(
      {
        ...storage,
        createPresignedGet: async (args) => {
          calls.push(args);
          return { url: "https://storage.test/get" };
        },
      },
      () => new Date("2026-11-17T09:00:00.000Z"),
    );
    const link = await files.downloadLink({ key: "k.pdf", fileName: "Consignor agreement v2.pdf" });
    expect(link.expiresAt.toISOString()).toBe("2026-11-17T09:05:00.000Z");
    expect(calls).toEqual([
      {
        key: "k.pdf",
        expiresInSec: 300,
        responseContentDisposition: 'attachment; filename="Consignor agreement v2.pdf"',
      },
    ]);
  });
});
