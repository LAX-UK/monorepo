import { describe, expect, it, vi } from "vitest";
import type { IAuthedApiClient } from "../http/authed-api-client";
import { serviceSuccess } from "../http/service-result";
import { AdminSavedViewService } from "./admin-saved-view.service";

const VIEW = {
  id: "a",
  listKey: "bid-admin.lots",
  label: "Drafts",
  query: "status=draft",
  position: 0,
};

function setup(body: unknown = {}) {
  const json = vi.fn(async () => serviceSuccess(body, 200));
  const service = new AdminSavedViewService({ json } as unknown as IAuthedApiClient);
  const call = () =>
    json.mock.calls.at(-1) as unknown as [string, RequestInit & Record<string, unknown>];
  return { service, json, call };
}

describe("AdminSavedViewService", () => {
  it("lists one list's views", async () => {
    const { service, call } = setup({ data: { items: [VIEW] } });

    const result = await service.list("bid-admin.lots");

    expect(result).toMatchObject({ ok: true, data: [VIEW] });
    expect(call()[0]).toBe("/admin/saved-views?listKey=bid-admin.lots");
  });

  it("creates with the list, name and query", async () => {
    const { service, call } = setup({ data: VIEW });

    const result = await service.create({
      listKey: "bid-admin.lots",
      label: "Drafts",
      query: "status=draft",
    });

    expect(result).toMatchObject({ ok: true, data: VIEW });
    const [path, init] = call();
    expect(path).toBe("/admin/saved-views");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      listKey: "bid-admin.lots",
      label: "Drafts",
      query: "status=draft",
    });
  });

  it("renames, reorders and deletes by id", async () => {
    const { service, json, call } = setup({ data: VIEW });
    await service.rename("a b", "New");
    expect(call()[0]).toBe("/admin/saved-views/a%20b");
    expect(call()[1].method).toBe("PATCH");

    json.mockResolvedValueOnce(serviceSuccess({ data: { items: [VIEW] } }, 200));
    await service.reorder("bid-admin.lots", ["a"]);
    expect(call()[0]).toBe("/admin/saved-views/order");
    expect(JSON.parse(call()[1].body as string)).toEqual({ listKey: "bid-admin.lots", ids: ["a"] });

    json.mockResolvedValueOnce(serviceSuccess({}, 204));
    expect(await service.remove("a")).toMatchObject({ ok: true });
    expect(call()[1].method).toBe("DELETE");
  });

  it("does not send the acting legal entity header: views belong to the person", async () => {
    const { service, call } = setup({ data: { items: [] } });

    await service.list("bid-admin.clients");

    expect(call()[1]).toMatchObject({ skipActingLegalEntityHeader: true });
  });

  it("passes the API's failure and code through", async () => {
    const failure = {
      ok: false as const,
      message: "You already have a view with that name.",
      status: 409,
      code: "duplicate_label",
    };
    const json = vi.fn(async () => failure);
    const service = new AdminSavedViewService({ json } as unknown as IAuthedApiClient);

    expect(await service.create({ listKey: "bid-admin.lots", label: "x", query: "" })).toEqual(
      failure,
    );
  });

  it("fails clearly when a success has no view in it", async () => {
    const { service } = setup({});

    expect(await service.rename("a", "x")).toMatchObject({ ok: false });
  });
});
