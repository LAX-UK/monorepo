import type { NotificationAccountMuteRecord } from "@auction/persistence/interfaces";
import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { describe, expect, it, vi } from "vitest";
import { NotificationAccountMuteService } from "../../services/notifications/notification-account-mute.service.js";
import { UserNotificationsHttpApplicationService } from "../../services/user/user-notifications-http-application.service.js";
import type { UserHono, UserRouteDeps } from "./_shared.js";
import { attachUserNotificationsRoutes } from "./notifications.routes.js";

const ORG = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

function mount(memberOf: string[] = [ORG]) {
  const listForUserFiltered = vi.fn().mockResolvedValue([]);
  const countForUser = vi.fn().mockResolvedValue({ needsAction: 4, unread: 6 });
  const muted = new Map<string, NotificationAccountMuteRecord>();
  const mutes = new NotificationAccountMuteService({
    listMutedAccountIds: async () => [...muted.keys()],
    listForUser: async () => [...muted.values()],
    isMemberOfOrganisation: async (_userId, id) => memberOf.includes(id),
    mute: async (_userId, id) => {
      muted.set(id, { legalEntityId: id, displayName: "Northbank Gallery", mutedAt: new Date(0) });
    },
    unmute: async (_userId, id) => muted.delete(id),
  });
  const notificationsHttp = new UserNotificationsHttpApplicationService(
    { listForUserFiltered, countForUser } as never,
    mutes,
  );
  const users = new Hono() as UserHono;
  users.use("*", async (c, next) => {
    c.set("userId", "ada");
    await next();
  });
  const passThrough: MiddlewareHandler = async (_c, next) => next();
  attachUserNotificationsRoutes(users, {
    container: { userRoutes: { notificationsHttp } },
    requireAuth: passThrough,
  } as unknown as UserRouteDeps);
  return { app: new Hono().route("/users", users), listForUserFiltered, countForUser };
}

describe("notification inbox routes", () => {
  it("counts what needs action and what is unread, for one account when asked", async () => {
    const { app, countForUser } = mount();
    const res = await app.request(`/users/me/notifications/counts?account=${ORG}`);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { data: unknown }).data).toEqual({ needsAction: 4, unread: 6 });
    expect(countForUser).toHaveBeenCalledWith("ada", {
      account: { kind: "entity", legalEntityId: ORG },
    });
    expect((await app.request("/users/me/notifications/counts?account=x")).status).toBe(400);
  });

  it("passes the needs-action view and an organisation filter through", async () => {
    const { app, listForUserFiltered } = mount();
    const res = await app.request(`/users/me/notifications?tab=needs_action&account=${ORG}`);
    expect(res.status).toBe(200);
    expect(listForUserFiltered).toHaveBeenCalledWith("ada", {
      limit: 20,
      offset: 0,
      tab: "needs_action",
      type: undefined,
      account: { kind: "entity", legalEntityId: ORG },
    });
  });

  it("filters to the person's own account", async () => {
    const { app, listForUserFiltered } = mount();
    await app.request("/users/me/notifications?account=personal");
    expect(listForUserFiltered.mock.calls[0]?.[1]).toMatchObject({
      tab: "all",
      account: { kind: "personal" },
    });
  });

  it("searches the title and message, trimmed and capped", async () => {
    const { app, listForUserFiltered } = mount();
    await app.request(`/users/me/notifications?q=${encodeURIComponent("  Arles  ")}`);
    expect(listForUserFiltered.mock.calls[0]?.[1]).toMatchObject({ query: "Arles" });
    await app.request(`/users/me/notifications?q=${"a".repeat(300)}`);
    expect(listForUserFiltered.mock.calls[1]?.[1]?.query).toHaveLength(100);
  });

  it("rejects an account that is neither personal nor an id", async () => {
    const { app, listForUserFiltered } = mount();
    const res = await app.request("/users/me/notifications?account=northbank");
    expect(res.status).toBe(400);
    expect(listForUserFiltered).not.toHaveBeenCalled();
  });
});

describe("notification mute routes", () => {
  it("mutes an organisation, lists it, and unmutes it", async () => {
    const { app } = mount();
    expect(
      (await app.request(`/users/me/notification-mutes/${ORG}`, { method: "PUT" })).status,
    ).toBe(204);
    const listed = await app.request("/users/me/notification-mutes");
    expect(await listed.json()).toEqual({
      data: [
        {
          legalEntityId: ORG,
          displayName: "Northbank Gallery",
          mutedAt: "1970-01-01T00:00:00.000Z",
        },
      ],
    });
    expect(
      (await app.request(`/users/me/notification-mutes/${ORG}`, { method: "DELETE" })).status,
    ).toBe(204);
  });

  it("refuses to mute an organisation the person does not belong to", async () => {
    const { app } = mount([]);
    const res = await app.request(`/users/me/notification-mutes/${ORG}`, { method: "PUT" });
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: "not_an_organisation_member" });
  });

  it("validates the account id", async () => {
    const { app } = mount();
    expect((await app.request("/users/me/notification-mutes/x", { method: "PUT" })).status).toBe(
      400,
    );
  });
});
