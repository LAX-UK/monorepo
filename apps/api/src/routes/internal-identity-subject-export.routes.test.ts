import {
  SUBJECT_EXPORT_MACHINE_SCOPE,
  deletionEligibilityPath,
  subjectExportManifestPath,
  subjectExportPagePath,
} from "@auction/identity-contracts";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { UnknownSubjectExportCategoryError } from "../subject-export/subject-export.service.js";
import { InvalidSubjectExportCursorError } from "../subject-export/subject-export.types.js";
import { createInternalIdentityDeletionEligibilityRoutes } from "./internal-identity-deletion-eligibility.routes.js";
import { createInternalIdentitySubjectExportRoutes } from "./internal-identity-subject-export.routes.js";

vi.mock("@auction/observability", () => ({ Sentry: { captureException: vi.fn() } }));

const exportCredentials = {
  IDENTITY_SUBJECT_EXPORT_CLIENT_ID: "export-client",
  IDENTITY_SUBJECT_EXPORT_CLIENT_SECRET: "subject-export-secret-at-least-32-characters",
};
const eligibilityCredentials = {
  IDENTITY_MACHINE_CLIENT_ID: "auth-service",
  IDENTITY_MACHINE_CLIENT_SECRET: "identity-machine-secret-at-least-32-characters",
};
const SUBJECT = "11111111-1111-4111-8111-111111111111";

const headers = (overrides: Record<string, string> = {}) => ({
  "x-identity-client-id": exportCredentials.IDENTITY_SUBJECT_EXPORT_CLIENT_ID,
  "x-identity-client-secret": exportCredentials.IDENTITY_SUBJECT_EXPORT_CLIENT_SECRET,
  "x-identity-client-scope": SUBJECT_EXPORT_MACHINE_SCOPE,
  ...overrides,
});

function createApp(service: Partial<Record<"manifest" | "page", ReturnType<typeof vi.fn>>> = {}) {
  const subjectExportService = {
    manifest: service.manifest ?? vi.fn().mockResolvedValue({ product: "bid", categories: [] }),
    page: service.page ?? vi.fn().mockResolvedValue({ records: [], nextCursor: null }),
  };
  const app = new Hono().route(
    "/internal/identity",
    createInternalIdentitySubjectExportRoutes(
      { subjectExportService: subjectExportService as never },
      exportCredentials,
    ),
  );
  return { app, subjectExportService };
}

describe("internal Identity subject-export routes (Bid)", () => {
  it("serves the manifest at the contract's path", async () => {
    const { app, subjectExportService } = createApp();
    const response = await app.request(subjectExportManifestPath(SUBJECT), { headers: headers() });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ product: "bid", categories: [] });
    expect(subjectExportService.manifest).toHaveBeenCalledWith(SUBJECT);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("serves a category page and passes the cursor on", async () => {
    const { app, subjectExportService } = createApp();
    const response = await app.request(subjectExportPagePath(SUBJECT, "bids", "abc"), {
      headers: headers(),
    });
    expect(response.status).toBe(200);
    expect(subjectExportService.page).toHaveBeenCalledWith(SUBJECT, "bids", "abc");
  });

  it("starts at the first page without a cursor", async () => {
    const { app, subjectExportService } = createApp();
    await app.request(subjectExportPagePath(SUBJECT, "bids"), { headers: headers() });
    expect(subjectExportService.page).toHaveBeenCalledWith(SUBJECT, "bids", null);
  });

  it("answers 404 for an unknown category and 400 for a bad cursor", async () => {
    const unknown = createApp({
      page: vi.fn().mockRejectedValue(new UnknownSubjectExportCategoryError("x")),
    });
    expect(
      (await unknown.app.request(subjectExportPagePath(SUBJECT, "x"), { headers: headers() }))
        .status,
    ).toBe(404);
    const bad = createApp({
      page: vi.fn().mockRejectedValue(new InvalidSubjectExportCursorError()),
    });
    expect(
      (await bad.app.request(subjectExportPagePath(SUBJECT, "bids", "zz"), { headers: headers() }))
        .status,
    ).toBe(400);
  });

  it("answers 503 without leaking the error when a reader fails", async () => {
    const { app } = createApp({
      manifest: vi.fn().mockRejectedValue(new Error("db password=hunter2")),
    });
    const response = await app.request(subjectExportManifestPath(SUBJECT), { headers: headers() });
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("hunter2");
  });

  describe("authentication", () => {
    it.each([
      ["no credentials", {}],
      ["a wrong secret", { "x-identity-client-secret": "wrong-secret-wrong-secret-wrong-secret" }],
      ["a wrong client id", { "x-identity-client-id": "someone-else" }],
      ["a missing scope", { "x-identity-client-scope": "" }],
      ["the wrong scope", { "x-identity-client-scope": "deletion_eligibility" }],
    ])("rejects %s", async (_label, override) => {
      const { app, subjectExportService } = createApp();
      const base =
        override && Object.keys(override).length === 0
          ? {}
          : headers(override as Record<string, string>);
      const response = await app.request(subjectExportManifestPath(SUBJECT), { headers: base });
      expect(response.status).toBe(401);
      expect(subjectExportService.manifest).not.toHaveBeenCalled();
    });

    it("rejects the deletion-eligibility credential, even with the export scope", async () => {
      const { app } = createApp();
      const response = await app.request(subjectExportManifestPath(SUBJECT), {
        headers: {
          "x-identity-client-id": eligibilityCredentials.IDENTITY_MACHINE_CLIENT_ID,
          "x-identity-client-secret": eligibilityCredentials.IDENTITY_MACHINE_CLIENT_SECRET,
          "x-identity-client-scope": SUBJECT_EXPORT_MACHINE_SCOPE,
        },
      });
      expect(response.status).toBe(401);
    });

    it("keeps the export credential out of the deletion-eligibility route", async () => {
      const app = new Hono().route(
        "/internal/identity",
        createInternalIdentityDeletionEligibilityRoutes(
          { accountDeletionEligibilityService: { listBlockers: vi.fn() } as never },
          eligibilityCredentials,
        ),
      );
      const response = await app.request(deletionEligibilityPath(SUBJECT), { headers: headers() });
      expect(response.status).toBe(401);
    });

    it("is closed when the export credentials are not configured", async () => {
      const app = new Hono().route(
        "/internal/identity",
        createInternalIdentitySubjectExportRoutes(
          { subjectExportService: { manifest: vi.fn(), page: vi.fn() } as never },
          {
            IDENTITY_SUBJECT_EXPORT_CLIENT_ID: undefined,
            IDENTITY_SUBJECT_EXPORT_CLIENT_SECRET: undefined,
          },
        ),
      );
      expect(
        (await app.request(subjectExportManifestPath(SUBJECT), { headers: headers() })).status,
      ).toBe(503);
    });
  });
});
