import { verifyBearerToken } from "@auction/auth/token-verifier";
import { OIDC_ACR_SILVER } from "@auction/identity-contracts";
import type { ShopStaffRole } from "@auction/shop-domain";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(),
}));

import { createShopApiApp } from "../../../app.js";
import { createMinimalShopApiTestDeps } from "../../../test-app-deps.js";

const TASK = "00000000-0000-4000-8000-0000000000c1";
const KEY = "99999999-9999-4999-8999-999999999999";
const headers = { authorization: "Bearer admin-token-placeholder-minimum-length" };
const url = `/admin/v1/framing-tasks/${TASK}`;
const body = { status: "framing", expectedVersion: 1 };

async function buildApp(role: ShopStaffRole) {
  vi.mocked(verifyBearerToken).mockReset();
  vi.mocked(verifyBearerToken).mockResolvedValue({
    subject: `${role}-subject`,
    payload: {
      scope: "shop.admin",
      acr: OIDC_ACR_SILVER,
      auth_time: Math.floor(Date.now() / 1000),
    },
  } as never);
  const updateFramingTask = vi.fn(async (_command: { idempotencyKey: string }) => ({
    taskId: TASK,
    orderLineId: "00000000-0000-4000-8000-0000000000c2",
    status: "framing" as const,
    dueAt: "2026-11-30T00:00:00.000Z",
    version: 2,
  }));
  const base = createMinimalShopApiTestDeps();
  const app = createShopApiApp({
    deps: createMinimalShopApiTestDeps({
      env: { ...base.env, SHOP_ADMIN_ENABLED: true },
      staffReader: {
        findActiveByIdentitySubject: async (subject) => ({
          roles: [role],
          identitySubjectId: subject,
        }),
        brokerCanAccessClientParty: async () => false,
      },
      admin: { ...base.admin, updateFramingTask },
    }),
    logger: false,
  });
  await app.ready();
  return { app, updateFramingTask };
}

describe("admin framing task route", () => {
  it("lets production staff move a frame on, passing the key and the version they saw", async () => {
    const { app, updateFramingTask } = await buildApp("operations");
    const response = await app.inject({
      method: "PUT",
      url,
      headers: { ...headers, "idempotency-key": KEY },
      payload: body,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "framing", version: 2 });
    expect(updateFramingTask).toHaveBeenCalledWith({
      taskId: TASK,
      status: "framing",
      expectedVersion: 1,
      actorSubjectId: "operations-subject",
      idempotencyKey: KEY,
    });
    await app.close();
  });

  it("sends the same key again unchanged, so a replay reaches the handler's stored result", async () => {
    const { app, updateFramingTask } = await buildApp("operations");
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await app.inject({
        method: "PUT",
        url,
        headers: { ...headers, "idempotency-key": KEY },
        payload: body,
      });
      expect(response.statusCode).toBe(200);
    }
    const keys = updateFramingTask.mock.calls.map(([command]) => command.idempotencyKey);
    expect(keys).toEqual([KEY, KEY]);
    await app.close();
  });

  it("refuses a request without an idempotency key", async () => {
    const { app, updateFramingTask } = await buildApp("operations");
    const response = await app.inject({ method: "PUT", url, headers, payload: body });
    expect(response.statusCode).toBe(400);
    expect(updateFramingTask).not.toHaveBeenCalled();
    await app.close();
  });

  it.each(["read_only", "catalogue_editor", "finance"] as const)(
    "refuses %s, who cannot work on production",
    async (role) => {
      const { app, updateFramingTask } = await buildApp(role);
      const response = await app.inject({
        method: "PUT",
        url,
        headers: { ...headers, "idempotency-key": KEY },
        payload: body,
      });
      expect(response.statusCode).toBe(403);
      expect(updateFramingTask).not.toHaveBeenCalled();
      await app.close();
    },
  );

  it("refuses a status that is not a framing step", async () => {
    const { app } = await buildApp("operations");
    const response = await app.inject({
      method: "PUT",
      url,
      headers: { ...headers, "idempotency-key": KEY },
      payload: { status: "printing", expectedVersion: 1 },
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });
});
