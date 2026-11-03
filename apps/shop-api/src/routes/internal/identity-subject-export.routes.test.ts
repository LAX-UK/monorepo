import {
  SUBJECT_EXPORT_MACHINE_SCOPE,
  deletionEligibilityPath,
  subjectExportManifestPath,
  subjectExportManifestSchema,
  subjectExportPagePath,
  subjectExportPageSchema,
} from "@auction/identity-contracts";
import { InvalidSubjectExportCursorError } from "@auction/identity-contracts/subject-export-readers";
import { describe, expect, it, vi } from "vitest";
import { createShopApiApp } from "../../app.js";
import { UnknownSubjectExportCategoryError } from "../../application/subject-export/subject-export.service.js";
import { createMinimalShopApiTestDeps } from "../../test-app-deps.js";

const SUBJECT = "11111111-1111-4111-8111-111111111111";
const EXPORT_ID = "subject-export";
const EXPORT_SECRET = "subject-export-secret-at-least-32-characters";
const ELIGIBILITY_ID = "api-service";
const ELIGIBILITY_SECRET = "identity-machine-secret-at-least-32-characters";

const exportHeaders = {
  "x-identity-client-id": EXPORT_ID,
  "x-identity-client-secret": EXPORT_SECRET,
  "x-identity-client-scope": SUBJECT_EXPORT_MACHINE_SCOPE,
};

function app(
  overrides: {
    manifest?: ReturnType<typeof vi.fn>;
    page?: ReturnType<typeof vi.fn>;
    credentials?: { clientId?: string; clientSecret?: string };
  } = {},
) {
  const manifest =
    overrides.manifest ??
    vi.fn(async () => ({
      product: "shop" as const,
      categories: [{ id: "orders", schemaVersion: 1, count: 2 }],
    }));
  const page =
    overrides.page ??
    vi.fn(async () => ({ records: [{ id: "o1", origin: "provided" as const }], nextCursor: null }));
  const credentials = overrides.credentials ?? {
    clientId: EXPORT_ID,
    clientSecret: EXPORT_SECRET,
  };
  const instance = createShopApiApp({
    deps: createMinimalShopApiTestDeps({
      identityDeletion: {
        eligibility: { listBlockers: async () => [] },
        machine: { clientId: ELIGIBILITY_ID, clientSecret: ELIGIBILITY_SECRET },
      },
      identitySubjectExport: {
        exports: { manifest: manifest as never, page: page as never },
        machine: { clientId: credentials.clientId, clientSecret: credentials.clientSecret },
      },
    }),
    logger: false,
  });
  return { instance, manifest, page };
}

describe("internal Identity subject-export routes (Shop)", () => {
  it("serves the manifest at the contract's path, in its shape", async () => {
    const { instance, manifest } = app();
    const response = await instance.inject({
      method: "GET",
      url: subjectExportManifestPath(SUBJECT),
      headers: exportHeaders,
    });
    expect(response.statusCode).toBe(200);
    expect(subjectExportManifestSchema.parse(response.json()).product).toBe("shop");
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(manifest).toHaveBeenCalledWith(SUBJECT);
  });

  it("serves a category page and passes the cursor on", async () => {
    const { instance, page } = app();
    const response = await instance.inject({
      method: "GET",
      url: subjectExportPagePath(SUBJECT, "orders", "abc"),
      headers: exportHeaders,
    });
    expect(response.statusCode).toBe(200);
    expect(subjectExportPageSchema.parse(response.json()).records).toHaveLength(1);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(page).toHaveBeenCalledWith(SUBJECT, "orders", "abc");
  });

  it("starts at the first page without a cursor", async () => {
    const { instance, page } = app();
    await instance.inject({
      method: "GET",
      url: subjectExportPagePath(SUBJECT, "orders"),
      headers: exportHeaders,
    });
    expect(page).toHaveBeenCalledWith(SUBJECT, "orders", null);
  });

  it("answers 404 for an unknown category and 400 for a bad cursor", async () => {
    const unknown = app({
      page: vi.fn().mockRejectedValue(new UnknownSubjectExportCategoryError("x")),
    });
    expect(
      (
        await unknown.instance.inject({
          method: "GET",
          url: subjectExportPagePath(SUBJECT, "x"),
          headers: exportHeaders,
        })
      ).statusCode,
    ).toBe(404);
    const bad = app({ page: vi.fn().mockRejectedValue(new InvalidSubjectExportCursorError()) });
    expect(
      (
        await bad.instance.inject({
          method: "GET",
          url: subjectExportPagePath(SUBJECT, "orders", "nope"),
          headers: exportHeaders,
        })
      ).statusCode,
    ).toBe(400);
  });

  it.each([
    ["no credentials", {}],
    ["the wrong id", { ...exportHeaders, "x-identity-client-id": "someone-else" }],
    ["the wrong secret", { ...exportHeaders, "x-identity-client-secret": "wrong-secret" }],
    ["no scope", { ...exportHeaders, "x-identity-client-scope": "" }],
    ["another scope", { ...exportHeaders, "x-identity-client-scope": "deletion_eligibility" }],
    ["a user's bearer token", { authorization: "Bearer a-users-access-token" }],
    [
      "the deletion-eligibility credential",
      {
        "x-identity-client-id": ELIGIBILITY_ID,
        "x-identity-client-secret": ELIGIBILITY_SECRET,
        "x-identity-client-scope": SUBJECT_EXPORT_MACHINE_SCOPE,
      },
    ],
  ])("refuses a caller with %s without reading anything", async (_label, headers) => {
    const { instance, manifest, page } = app();
    for (const url of [
      subjectExportManifestPath(SUBJECT),
      subjectExportPagePath(SUBJECT, "orders"),
    ]) {
      const response = await instance.inject({ method: "GET", url, headers });
      expect(response.statusCode).toBe(401);
    }
    expect(manifest).not.toHaveBeenCalled();
    expect(page).not.toHaveBeenCalled();
  });

  it("does not let the export credential answer the deletion-eligibility question", async () => {
    const { instance } = app();
    const response = await instance.inject({
      method: "GET",
      url: deletionEligibilityPath(SUBJECT),
      headers: exportHeaders,
    });
    expect(response.statusCode).toBe(401);
  });

  it("is closed, not open, when the export credential is not configured", async () => {
    const { instance, manifest } = app({ credentials: {} });
    const response = await instance.inject({
      method: "GET",
      url: subjectExportManifestPath(SUBJECT),
      headers: exportHeaders,
    });
    expect(response.statusCode).toBe(503);
    expect(manifest).not.toHaveBeenCalled();
  });

  it("answers 503, never a shorter answer, when the data cannot be read", async () => {
    const { instance } = app({
      manifest: vi.fn().mockRejectedValue(new Error("database down")),
      page: vi.fn().mockRejectedValue(new Error("database down")),
    });
    for (const url of [
      subjectExportManifestPath(SUBJECT),
      subjectExportPagePath(SUBJECT, "orders"),
    ]) {
      const response = await instance.inject({ method: "GET", url, headers: exportHeaders });
      expect(response.statusCode).toBe(503);
      expect(response.json()).toEqual({ error: "subject_export_unavailable" });
    }
  });
});
