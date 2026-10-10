import type { TwoFactorPolicyStore } from "@auction/auth";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { createInternalIdentityRoutes } from "./internal-identity.routes.js";
import { mountTwoFactorPolicyRoutes } from "./internal-two-factor-policy.routes.js";

const ORG = "6f1c3c1e-6c55-4a51-9a4e-2f1e8d2c7a10";
const AT = new Date("2026-10-10T12:00:00.000Z");

function setup() {
  const store = {
    readSubjectPolicyInputs: vi.fn(),
    readPolicy: vi.fn(async () => null),
    writePolicy: vi.fn(async (scope, input) => ({ ...scope, ...input, setAt: input.at })),
    countCoverage: vi.fn(async () => ({ members: 4, enrolled: 3 })),
    readTwoFactorEnabled: vi.fn(
      async (ids: readonly string[]) => new Map(ids.map((id) => [id, id === "subject-1"])),
    ),
  } satisfies TwoFactorPolicyStore;
  const readRequirement = vi.fn(async () => ({
    required: true,
    sources: [{ scope: "org" as const, legalEntityId: ORG }],
  }));
  const app = new Hono();
  mountTwoFactorPolicyRoutes(app, { store, readRequirement, now: () => AT });
  return { app, store, readRequirement };
}

const json = (body: unknown, method = "PUT") => ({
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

describe("internal two-step verification policy routes", () => {
  it("reports staff as required by default with coverage", async () => {
    const { app } = setup();

    const response = await app.request("/identity/two-factor-policies/staff");

    expect(await response.json()).toEqual({
      policy: { required: true, setBySubjectId: null, setAt: null },
      coverage: { members: 4, enrolled: 3 },
    });
  });

  it("reports organisations as optional by default", async () => {
    const { app } = setup();

    const response = await app.request(`/identity/two-factor-policies/orgs/${ORG}`);

    expect(await response.json()).toMatchObject({ policy: { required: false } });
  });

  it("records who changed an organisation policy", async () => {
    const { app, store } = setup();

    const response = await app.request(
      `/identity/two-factor-policies/orgs/${ORG}`,
      json({ required: true, actorSubjectId: "owner-1" }),
    );

    expect(response.status).toBe(200);
    expect(store.writePolicy).toHaveBeenCalledWith(
      { scope: "org", legalEntityId: ORG },
      { required: true, setBySubjectId: "owner-1", at: AT },
    );
  });

  it("rejects policy writes without an actor or a boolean", async () => {
    const { app, store } = setup();

    const missingActor = await app.request(
      "/identity/two-factor-policies/staff",
      json({ required: false }),
    );
    const notBoolean = await app.request(
      "/identity/two-factor-policies/staff",
      json({ required: "no", actorSubjectId: "admin-1" }),
    );
    const badOrg = await app.request(
      "/identity/two-factor-policies/orgs/not-a-uuid",
      json({ required: true, actorSubjectId: "owner-1" }),
    );

    expect([missingActor.status, notBoolean.status, badOrg.status]).toEqual([400, 400, 400]);
    expect(store.writePolicy).not.toHaveBeenCalled();
  });

  it("returns a subject's requirement and sources", async () => {
    const { app } = setup();

    const response = await app.request("/identity/subjects/subject-1/two-factor-requirement");

    expect(await response.json()).toEqual({
      requirement: { required: true, sources: [{ scope: "org", legalEntityId: ORG }] },
    });
  });

  it("returns batch two-step status for known subjects and bounds the batch", async () => {
    const { app } = setup();

    const response = await app.request(
      "/identity/subjects/two-factor-status",
      json({ subjectIds: ["subject-1", "subject-2", "subject-1"] }, "POST"),
    );
    const tooMany = await app.request(
      "/identity/subjects/two-factor-status",
      json({ subjectIds: Array.from({ length: 201 }, (_, i) => `s-${i}`) }, "POST"),
    );

    expect(await response.json()).toEqual({
      statuses: [
        { subjectId: "subject-1", twoFactorEnabled: true },
        { subjectId: "subject-2", twoFactorEnabled: false },
      ],
    });
    expect(tooMany.status).toBe(400);
  });

  it("is only reachable with a machine token when mounted on the Identity routes", async () => {
    const { store, readRequirement } = setup();
    const app = createInternalIdentityRoutes({
      lifecycle: { disable: vi.fn(), enable: vi.fn(), merge: vi.fn() },
      operations: {} as never,
      redis: {
        get: async () => null,
        set: vi.fn(),
        del: vi.fn(),
        incr: async () => 1,
        expire: async () => 1,
        ttl: async () => 60,
      },
      machineClientId: "api-service",
      machineClientSecret: "machine-secret-at-least-32-characters",
      twoFactorPolicy: { store, readRequirement },
    });

    const response = await app.request("/identity/two-factor-policies/staff");

    expect(response.status).toBe(401);
    expect(store.readPolicy).not.toHaveBeenCalled();
  });
});
