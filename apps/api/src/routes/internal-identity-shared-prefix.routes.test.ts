import {
  SUBJECT_EXPORT_MACHINE_SCOPE,
  deletionEligibilityPath,
  subjectExportManifestPath,
  subjectExportPagePath,
} from "@auction/identity-contracts";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { createInternalIdentityDeletionEligibilityRoutes } from "./internal-identity-deletion-eligibility.routes.js";
import { createInternalIdentityEmailRoutes } from "./internal-identity-email.routes.js";
import { createInternalIdentitySubjectExportRoutes } from "./internal-identity-subject-export.routes.js";
import { createInternalIdentitySubjectUsageRoutes } from "./internal-identity-subject-usage.routes.js";

vi.mock("@auction/observability", () => ({ Sentry: { captureException: vi.fn() } }));

const identity = {
  IDENTITY_MACHINE_CLIENT_ID: "auth-service",
  IDENTITY_MACHINE_CLIENT_SECRET: "identity-machine-secret-at-least-32-characters",
};
const exporter = {
  IDENTITY_SUBJECT_EXPORT_CLIENT_ID: "subject-export",
  IDENTITY_SUBJECT_EXPORT_CLIENT_SECRET: "subject-export-secret-at-least-32-characters",
};
const SUBJECT = "11111111-1111-4111-8111-111111111111";

const identityHeaders = {
  "x-identity-client-id": identity.IDENTITY_MACHINE_CLIENT_ID,
  "x-identity-client-secret": identity.IDENTITY_MACHINE_CLIENT_SECRET,
};
const exportHeaders = {
  "x-identity-client-id": exporter.IDENTITY_SUBJECT_EXPORT_CLIENT_ID,
  "x-identity-client-secret": exporter.IDENTITY_SUBJECT_EXPORT_CLIENT_SECRET,
  "x-identity-client-scope": SUBJECT_EXPORT_MACHINE_SCOPE,
};

/** All four groups on the one prefix, in the order app.ts mounts them. */
function createApp() {
  const env = { ...identity, ...exporter };
  return new Hono()
    .route("/internal/identity", createInternalIdentityEmailRoutes({} as never, env))
    .route(
      "/internal/identity",
      createInternalIdentitySubjectUsageRoutes(
        { subjectUsageReader: { getSubjectUsage: vi.fn().mockResolvedValue({}) } } as never,
        env,
      ),
    )
    .route(
      "/internal/identity",
      createInternalIdentityDeletionEligibilityRoutes(
        {
          accountDeletionEligibilityService: { listBlockers: vi.fn().mockResolvedValue([]) },
        } as never,
        env,
      ),
    )
    .route(
      "/internal/identity",
      createInternalIdentitySubjectExportRoutes(
        {
          subjectExportService: {
            manifest: vi.fn().mockResolvedValue({ product: "bid", categories: [] }),
            page: vi.fn().mockResolvedValue({ records: [], nextCursor: null }),
          },
        } as never,
        env,
      ),
    );
}

describe("/internal/identity groups sharing one prefix", () => {
  it("lets the export credential read the export routes past the identity-credential groups", async () => {
    const app = createApp();
    const manifest = await app.request(subjectExportManifestPath(SUBJECT), {
      headers: exportHeaders,
    });
    expect(manifest.status).toBe(200);
    expect(manifest.headers.get("cache-control")).toBe("no-store");
    const page = await app.request(subjectExportPagePath(SUBJECT, "bids"), {
      headers: exportHeaders,
    });
    expect(page.status).toBe(200);
  });

  it("lets the identity credential reach its own routes past the export group", async () => {
    const app = createApp();
    expect(
      (await app.request(deletionEligibilityPath(SUBJECT), { headers: identityHeaders })).status,
    ).toBe(200);
    expect(
      (
        await app.request(`/internal/identity/subject-usage/${SUBJECT}`, {
          headers: identityHeaders,
        })
      ).status,
    ).toBe(200);
  });

  it("still keeps each credential out of the other's routes", async () => {
    const app = createApp();
    expect(
      (await app.request(subjectExportManifestPath(SUBJECT), { headers: identityHeaders })).status,
    ).toBe(401);
    expect(
      (await app.request(deletionEligibilityPath(SUBJECT), { headers: exportHeaders })).status,
    ).toBe(401);
    expect(
      (
        await app.request("/internal/identity/emails", {
          method: "POST",
          headers: exportHeaders,
          body: "{}",
        })
      ).status,
    ).toBe(401);
  });
});
