import { verifyBearerToken } from "@auction/auth/token-verifier";
import { OIDC_ACR_SILVER } from "@auction/identity-contracts";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import type { ShopStaffRole } from "@auction/shop-domain";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(),
}));

import { createShopApiApp } from "../../../app.js";
import { encodeCatalogueCursor } from "../../../application/catalogue-cursor.js";
import type {
  ProductionTaskRepository,
  UpdateProductionTaskInput,
} from "../../../application/ports/production-task.repository.js";
import { createProductionTaskService } from "../../../application/production-task.service.js";
import { createMinimalShopApiTestDeps } from "../../../test-app-deps.js";
import { createStubProductionTaskRepository } from "../../../test-support/stub-production-task-repository.js";

const ADMIN_TOKEN = "admin-token-placeholder-minimum-length";
const TASK_ID = "66666666-6666-4666-8666-666666666666";

const ALL_ROLES: ShopStaffRole[] = [
  "shop_admin",
  "account_manager",
  "broker",
  "operations",
  "finance",
  "catalogue_editor",
];
const CAN_WORK: ShopStaffRole[] = ["shop_admin", "operations"];

/** Staff the assignee check can find: an operator, and an account manager who cannot do production. */
const ACTIVE_STAFF: Record<string, ShopStaffRole> = {
  "colleague-subject": "operations",
  "manager-subject": "account_manager",
};

const detail = {
  taskId: TASK_ID,
  orderId: "77777777-7777-4777-8777-777777777777",
  orderLineId: "88888888-8888-4888-8888-888888888888",
  editionId: "99999999-9999-4999-8999-999999999999",
  artworkTitle: "Untitled",
  editionNumber: 3,
  status: "queued" as const,
  assignee: null,
  version: 1,
  createdAt: "2026-03-01T10:00:00.000Z",
  updatedAt: "2026-03-01T10:00:00.000Z",
  history: [],
};

async function buildApp(role: ShopStaffRole, repository: Partial<ProductionTaskRepository> = {}) {
  vi.mocked(verifyBearerToken).mockResolvedValue({
    subject: `${role}-subject`,
    payload: {
      scope: "shop.admin",
      acr: OIDC_ACR_SILVER,
      auth_time: Math.floor(Date.now() / 1000),
    },
  } as never);
  const staffReader = {
    findActiveByIdentitySubject: async (subject: string) => {
      if (subject === `${role}-subject`) return { role, identitySubjectId: subject };
      const colleague = ACTIVE_STAFF[subject];
      return colleague ? { role: colleague, identitySubjectId: subject } : null;
    },
    brokerCanAccessClientParty: async () => false,
  };
  const deps = createMinimalShopApiTestDeps({
    env: {
      ...createMinimalShopApiTestDeps().env,
      SHOP_ADMIN_ENABLED: true,
      SHOP_PAYOUTS_ENABLED: true,
    },
    staffReader,
  });
  deps.admin.productionTasks = createProductionTaskService({
    repository: createStubProductionTaskRepository({
      getDetail: async () => detail,
      update: async (input) => ({
        status: "updated",
        version: input.expectedVersion + 1,
        taskStatus: input.status ?? "queued",
      }),
      ...repository,
    }),
    staffReader,
  });
  const app = createShopApiApp({ deps, logger: false });
  await app.ready();
  return app;
}

const auth = { authorization: `Bearer ${ADMIN_TOKEN}` };
const patch = (payload: unknown) => ({
  method: "PATCH" as const,
  url: `/admin/v1/production/tasks/${TASK_ID}`,
  headers: auth,
  payload: payload as Record<string, unknown>,
});

describe("production task capabilities", () => {
  const probes = [
    { name: "list", method: "GET", url: "/admin/v1/production/tasks" },
    { name: "assignees", method: "GET", url: "/admin/v1/production/assignees" },
    { name: "detail", method: "GET", url: `/admin/v1/production/tasks/${TASK_ID}` },
    {
      name: "update",
      method: "PATCH",
      url: `/admin/v1/production/tasks/${TASK_ID}`,
      payload: { expectedVersion: 1, status: "printing" },
    },
  ] as const;
  const cases = probes.flatMap((probe) =>
    ALL_ROLES.map((role) => ({ probe, role, allowed: CAN_WORK.includes(role) })),
  );

  it.each(cases)("$probe.name as $role is allowed: $allowed", async ({ probe, role, allowed }) => {
    const app = await buildApp(role);
    const response = await app.inject({
      method: probe.method,
      url: probe.url,
      headers: auth,
      ...("payload" in probe ? { payload: probe.payload } : {}),
    });
    expect(allowed ? response.statusCode < 300 : response.statusCode === 403).toBe(true);
    await app.close();
  });

  it("refuses an unauthenticated update", async () => {
    const app = await buildApp("operations");
    const response = await app.inject({
      method: "PATCH",
      url: `/admin/v1/production/tasks/${TASK_ID}`,
      payload: { expectedVersion: 1, status: "printing" },
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });
});

describe("production task list", () => {
  it("turns the filters into repository filters, resolving me to the caller", async () => {
    const list = vi.fn<ProductionTaskRepository["list"]>(async () => ({
      items: [],
      nextCursor: null,
      counts: { queued: 2 },
    }));
    const app = await buildApp("operations", { list });
    const response = await app.inject({
      method: "GET",
      url: "/admin/v1/production/tasks?status=printing&assignee=me&q=%20%20Untitled%20&limit=10",
      headers: auth,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().counts).toEqual({ queued: 2 });
    expect(list).toHaveBeenCalledWith({
      filters: {
        status: "printing",
        assignee: { type: "subject", subject: "operations-subject" },
        q: "Untitled",
      },
      cursor: null,
      limit: 10,
    });
    await app.close();
  });

  it("filters to unassigned tasks and ignores a blank search", async () => {
    const list = vi.fn<ProductionTaskRepository["list"]>(async () => ({
      items: [],
      nextCursor: null,
      counts: {},
    }));
    const app = await buildApp("operations", { list });
    await app.inject({
      method: "GET",
      url: "/admin/v1/production/tasks?assignee=unassigned&q=%20",
      headers: auth,
    });
    expect(list).toHaveBeenCalledWith({
      filters: { assignee: { type: "unassigned" } },
      cursor: null,
      limit: 25,
    });
    await app.close();
  });

  it("encodes the next cursor for the caller and decodes it on the way back", async () => {
    const next = { createdAt: new Date("2026-03-01T10:00:00.000Z"), id: TASK_ID };
    const list = vi.fn<ProductionTaskRepository["list"]>(async () => ({
      items: [],
      nextCursor: next,
      counts: {},
    }));
    const app = await buildApp("operations", { list });
    const first = await app.inject({
      method: "GET",
      url: "/admin/v1/production/tasks",
      headers: auth,
    });
    expect(first.json().nextCursor).toBe(encodeCatalogueCursor(next));
    await app.inject({
      method: "GET",
      url: `/admin/v1/production/tasks?cursor=${first.json().nextCursor}`,
      headers: auth,
    });
    expect(list.mock.calls[1]?.[0].cursor).toEqual(next);
    await app.close();
  });

  it("rejects an unknown status and a malformed cursor", async () => {
    const app = await buildApp("operations");
    const status = await app.inject({
      method: "GET",
      url: "/admin/v1/production/tasks?status=shipped",
      headers: auth,
    });
    expect(status.statusCode).toBe(400);
    const cursor = await app.inject({
      method: "GET",
      url: "/admin/v1/production/tasks?cursor=not-a-cursor",
      headers: auth,
    });
    expect(cursor.statusCode).toBe(400);
    await app.close();
  });
});

describe("production task detail", () => {
  it("answers 404 for a task that does not exist", async () => {
    const app = await buildApp("operations", { getDetail: async () => null });
    const response = await app.inject({
      method: "GET",
      url: `/admin/v1/production/tasks/${TASK_ID}`,
      headers: auth,
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });
});

describe("production task update", () => {
  it("passes the move to the repository with the caller as actor", async () => {
    const update = vi.fn<ProductionTaskRepository["update"]>(async () => ({
      status: "updated",
      version: 2,
      taskStatus: "printing",
    }));
    const app = await buildApp("operations", { update });
    const response = await app.inject(patch({ expectedVersion: 1, status: "printing" }));
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ version: 2, status: "printing" });
    const input = update.mock.calls[0]?.[0] as UpdateProductionTaskInput;
    expect(input).toMatchObject({
      id: TASK_ID,
      expectedVersion: 1,
      status: "printing",
      actorSubjectId: "operations-subject",
    });
    expect(input.canMove("queued", "printing")).toBe(true);
    expect(input.canMove("queued", "completed")).toBe(false);
    await app.close();
  });

  it("answers 409 with the current version when the task has moved on", async () => {
    const app = await buildApp("operations", {
      update: async () => ({ status: "stale", currentVersion: 4 }),
    });
    const response = await app.inject(patch({ expectedVersion: 1, status: "printing" }));
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      code: SHOP_API_ERROR_CODES.CONFLICT,
      currentVersion: 4,
    });
    await app.close();
  });

  it("answers 409 naming the statuses when the move is not allowed", async () => {
    const app = await buildApp("operations", {
      update: async () => ({ status: "not_allowed", currentVersion: 2, from: "qc_pending" }),
    });
    const response = await app.inject(patch({ expectedVersion: 2, status: "completed" }));
    expect(response.statusCode).toBe(409);
    expect(response.json().message).toBe("A task that is qc pending cannot move to completed");
    await app.close();
  });

  it("answers 404 for a task that does not exist", async () => {
    const app = await buildApp("operations", { update: async () => ({ status: "not_found" }) });
    const response = await app.inject(patch({ expectedVersion: 1, status: "printing" }));
    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it("requires something to change", async () => {
    const update = vi.fn<ProductionTaskRepository["update"]>();
    const app = await buildApp("operations", { update });
    const response = await app.inject(patch({ expectedVersion: 1 }));
    expect(response.statusCode).toBe(400);
    expect(update).not.toHaveBeenCalled();
    await app.close();
  });

  it.each([
    ["no expectedVersion", { status: "printing" }],
    ["a zero version", { expectedVersion: 0, status: "printing" }],
    ["an unknown status", { expectedVersion: 1, status: "shipped" }],
  ])("rejects %s", async (_name, payload) => {
    const app = await buildApp("operations");
    const response = await app.inject(patch(payload));
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  describe("assignee", () => {
    it("accepts an active staff member who holds production.write", async () => {
      const update = vi.fn<ProductionTaskRepository["update"]>(async () => ({
        status: "updated",
        version: 2,
        taskStatus: "queued",
      }));
      const app = await buildApp("operations", { update });
      const response = await app.inject(
        patch({ expectedVersion: 1, assigneeSubject: "colleague-subject" }),
      );
      expect(response.statusCode).toBe(200);
      expect(update.mock.calls[0]?.[0]).toMatchObject({ assigneeSubject: "colleague-subject" });
      await app.close();
    });

    it("lets a task be unassigned", async () => {
      const update = vi.fn<ProductionTaskRepository["update"]>(async () => ({
        status: "updated",
        version: 2,
        taskStatus: "queued",
      }));
      const app = await buildApp("operations", { update });
      const response = await app.inject(patch({ expectedVersion: 1, assigneeSubject: null }));
      expect(response.statusCode).toBe(200);
      expect(update.mock.calls[0]?.[0].assigneeSubject).toBeNull();
      await app.close();
    });

    it.each([
      ["staff without production.write", "manager-subject"],
      ["someone who is not staff", "stranger-subject"],
    ])("refuses %s", async (_name, assigneeSubject) => {
      const update = vi.fn<ProductionTaskRepository["update"]>();
      const app = await buildApp("operations", { update });
      const response = await app.inject(patch({ expectedVersion: 1, assigneeSubject }));
      expect(response.statusCode).toBe(400);
      expect(update).not.toHaveBeenCalled();
      await app.close();
    });
  });
});
