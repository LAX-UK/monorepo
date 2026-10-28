import { normalizeStaffRoles } from "@auction/types";
import type { StaffRoles } from "@auction/types";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { AdminSavedViewService } from "../../services/admin/admin-saved-view.service.js";
import { InMemoryAdminSavedViewRepository } from "../../testing/in-memory-admin-saved-view.repository.js";
import type { AdminHono } from "./_shared.js";
import { attachAdminSavedViewRoutes } from "./saved-views.routes.js";

const ALICE = "b2e48c7a-1f09-4d35-8a6e-5d3c9f7e2b14";
const BOB = "6d1f0a52-8b3c-4e97-a4d6-2c9e7b1f5a08";

type Session = { userId: string; role: string; staffRoles: StaffRoles | undefined };
const staff = (userId: string, staffRoles: StaffRoles | undefined): Session => ({
  userId,
  role: "staff",
  staffRoles,
});

/** The platform shell authenticates upstream; here a header-selected stub supplies the identity. */
function setup() {
  const repository = new InMemoryAdminSavedViewRepository();
  const service = new AdminSavedViewService(repository);
  const platform: AdminHono = new Hono();
  platform.use("*", async (c, next) => {
    const session = JSON.parse(c.req.header("x-test-session") ?? "{}") as Session;
    c.set("userId", session.userId);
    c.set("userRole", session.role);
    c.set("userStaffRoles", session.staffRoles);
    await next();
  });
  attachAdminSavedViewRoutes(platform, service);
  const app = new Hono();
  app.route("/admin", platform);

  const as = (session: Session) => {
    const call = (method: string, path: string, body?: unknown) =>
      app.request(`http://test/admin/saved-views${path}`, {
        method,
        headers: {
          "content-type": "application/json",
          "x-test-session": JSON.stringify(session),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    return {
      list: (listKey: string) => call("GET", `?listKey=${encodeURIComponent(listKey)}`),
      create: (body: unknown) => call("POST", "", body),
      rename: (id: string, label: string) => call("PATCH", `/${id}`, { label }),
      reorder: (listKey: string, ids: string[]) => call("PUT", "/order", { listKey, ids }),
      remove: (id: string) => call("DELETE", `/${id}`),
    };
  };
  return { as, repository };
}

const lotView = (label: string, query = "status=live") => ({
  listKey: "bid-admin.lots",
  label,
  query,
});

async function created(res: Response): Promise<{ id: string; label: string }> {
  expect(res.status).toBe(201);
  return ((await res.json()) as { data: { id: string; label: string } }).data;
}

describe("saved views by role", () => {
  it.each([
    ["administrator", "administrator"],
    ["cataloguer", "cataloguer"],
    ["sales manager", "sales_manager"],
  ])("lets a %s keep views for lots", async (_label, staffRoles) => {
    const { as } = setup();
    const person = as(staff(ALICE, normalizeStaffRoles([staffRoles])));

    await created(await person.create(lotView("Live")));

    const res = await person.list("bid-admin.lots");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      data: { items: [{ label: "Live", query: "status=live" }] },
    });
  });

  it.each([
    ["client services", "client_services"],
    ["read-only", "read_only"],
    ["finance", "finance"],
    ["fulfilment", "fulfilment"],
  ])("keeps lots views away from a %s", async (_label, staffRoles) => {
    const { as, repository } = setup();
    const person = as(staff(ALICE, normalizeStaffRoles([staffRoles])));

    expect((await person.list("bid-admin.lots")).status).toBe(403);
    expect((await person.create(lotView("Live"))).status).toBe(403);
    expect((await person.reorder("bid-admin.lots", [])).status).toBe(403);
    expect(repository.rows).toHaveLength(0);
  });

  it.each([
    ["administrator", "administrator", 200],
    ["client services", "client_services", 200],
    ["cataloguer", "cataloguer", 403],
    ["sales manager", "sales_manager", 403],
    ["read-only", "read_only", 403],
  ])("clients views for a %s answer %i", async (_label, staffRoles, status) => {
    const { as } = setup();
    const res = await as(staff(ALICE, normalizeStaffRoles([staffRoles]))).list("bid-admin.clients");
    expect(res.status).toBe(status);
  });

  it.each([
    ["administrator", "administrator", 200],
    ["cataloguer", "cataloguer", 200],
    ["sales manager", "sales_manager", 200],
    ["read-only", "read_only", 403],
  ])("submissions views for a %s answer %i", async (_label, staffRoles, status) => {
    const { as } = setup();
    const res = await as(staff(ALICE, normalizeStaffRoles([staffRoles]))).list(
      "bid-admin.submissions",
    );
    expect(res.status).toBe(status);
  });

  it.each([
    ["administrator", "administrator", 200],
    ["finance", "finance", 200],
    ["read-only", "read_only", 403],
    ["cataloguer", "cataloguer", 403],
  ])("payments views for a %s answer %i", async (_label, staffRoles, status) => {
    const { as } = setup();
    const res = await as(staff(ALICE, normalizeStaffRoles([staffRoles]))).list(
      "bid-admin.payments",
    );
    expect(res.status).toBe(status);
  });

  it("refuses a customer", async () => {
    const { as } = setup();
    const person = as({ userId: ALICE, role: "client", staffRoles: [] });
    expect((await person.list("bid-admin.lots")).status).toBe(403);
  });
});

describe("saved views by owner", () => {
  it("never shows one person's views to another", async () => {
    const { as } = setup();
    const alice = as(staff(ALICE, ["administrator"]));
    const bob = as(staff(BOB, ["administrator"]));
    await created(await alice.create(lotView("Alice only")));

    const res = await bob.list("bid-admin.lots");

    expect(await res.json()).toEqual({ data: { items: [] } });
  });

  it("lets two people use the same view name", async () => {
    const { as } = setup();
    await created(await as(staff(ALICE, ["administrator"])).create(lotView("Live")));
    await created(await as(staff(BOB, ["administrator"])).create(lotView("Live")));
  });

  it("answers 404 when renaming or deleting someone else's view, and leaves it unchanged", async () => {
    const { as, repository } = setup();
    const alice = as(staff(ALICE, ["administrator"]));
    const bob = as(staff(BOB, ["administrator"]));
    const view = await created(await alice.create(lotView("Alice only")));

    expect((await bob.rename(view.id, "Stolen")).status).toBe(404);
    expect((await bob.remove(view.id)).status).toBe(404);

    expect(repository.rows.map((row) => row.label)).toEqual(["Alice only"]);
  });

  it("does not let one person reorder using another's view ids", async () => {
    const { as } = setup();
    const alice = as(staff(ALICE, ["administrator"]));
    const bob = as(staff(BOB, ["administrator"]));
    const view = await created(await alice.create(lotView("Alice only")));
    await created(await bob.create(lotView("Bob only")));

    const res = await bob.reorder("bid-admin.lots", [view.id]);

    expect(res.status).toBe(409);
  });
});

describe("saved views rules", () => {
  it("rejects a list that is not in the allow-list", async () => {
    const { as } = setup();
    const person = as(staff(ALICE, ["administrator"]));
    expect((await person.list("bid-admin.secrets")).status).toBe(400);
    expect((await person.create({ listKey: "other", label: "x", query: "" })).status).toBe(400);
  });

  it("rejects an empty or over-long name and an over-long query", async () => {
    const { as } = setup();
    const person = as(staff(ALICE, ["administrator"]));
    expect((await person.create(lotView("   "))).status).toBe(400);
    expect((await person.create(lotView("x".repeat(41)))).status).toBe(400);
    expect((await person.create(lotView("Long", `q=${"a".repeat(1000)}`))).status).toBe(400);
  });

  it("trims the name and drops a leading question mark from the query", async () => {
    const { as } = setup();
    const person = as(staff(ALICE, ["administrator"]));
    await created(await person.create(lotView("  Live  ", "?status=live")));
    const res = await person.list("bid-admin.lots");
    expect(await res.json()).toMatchObject({
      data: { items: [{ label: "Live", query: "status=live" }] },
    });
  });

  it("answers 409 for a repeated name, with a code the admin can act on", async () => {
    const { as } = setup();
    const person = as(staff(ALICE, ["administrator"]));
    await created(await person.create(lotView("Live")));

    const res = await person.create(lotView("Live", "status=ended"));

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: "duplicate_label" });
  });

  it("answers 409 on rename to a name already used in the list", async () => {
    const { as } = setup();
    const person = as(staff(ALICE, ["administrator"]));
    await created(await person.create(lotView("Live")));
    const other = await created(await person.create(lotView("Ended", "status=ended")));

    const res = await person.rename(other.id, "Live");

    expect(res.status).toBe(409);
  });

  it("caps the views one person keeps for a list at 50", async () => {
    const { as } = setup();
    const person = as(staff(ALICE, ["administrator"]));
    for (let n = 0; n < 50; n += 1) {
      await created(await person.create(lotView(`View ${n}`)));
    }

    const res = await person.create(lotView("One too many"));

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: "limit_reached" });
    // The cap is per list: another list is unaffected.
    expect(
      (await person.create({ listKey: "bid-admin.clients", label: "Fresh", query: "" })).status,
    ).toBe(201);
  });

  it("renames, reorders and deletes", async () => {
    const { as } = setup();
    const person = as(staff(ALICE, ["administrator"]));
    const a = await created(await person.create(lotView("A")));
    const b = await created(await person.create(lotView("B", "status=ended")));
    const c = await created(await person.create(lotView("C", "status=draft")));

    expect((await person.rename(a.id, "Alpha")).status).toBe(200);
    const reordered = await person.reorder("bid-admin.lots", [c.id, a.id, b.id]);
    expect(reordered.status).toBe(200);
    expect(
      ((await reordered.json()) as { data: { items: { label: string }[] } }).data.items.map(
        (view) => view.label,
      ),
    ).toEqual(["C", "Alpha", "B"]);

    expect((await person.remove(b.id)).status).toBe(204);
    const left = await person.list("bid-admin.lots");
    expect(
      ((await left.json()) as { data: { items: { label: string }[] } }).data.items.map(
        (view) => view.label,
      ),
    ).toEqual(["C", "Alpha"]);
  });

  it("refuses a reorder that is not exactly the person's current views", async () => {
    const { as } = setup();
    const person = as(staff(ALICE, ["administrator"]));
    const a = await created(await person.create(lotView("A")));
    await created(await person.create(lotView("B", "status=ended")));

    const res = await person.reorder("bid-admin.lots", [a.id]);

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: "order_changed" });
  });

  it("answers 400 for an id that is not a uuid", async () => {
    const { as } = setup();
    expect((await as(staff(ALICE, ["administrator"])).remove("nope")).status).toBe(400);
  });
});
