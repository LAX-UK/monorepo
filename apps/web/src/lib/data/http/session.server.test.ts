import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const meGet = vi.fn();

vi.mock("@/lib/data/http/hc-server", () => ({
  getServerHc: async () => ({ users: { me: { $get: meGet } } }),
}));

// React `cache` is identity in tests so each call re-runs the resolver.
vi.mock("react", () => ({ cache: <T>(fn: T): T => fn }));

import { getServerSessionUser } from "./session.server";

const sessionUser = { id: "u1", email: "a@b.com" };
const parsedSessionUser = {
  id: "u1",
  email: "a@b.com",
  name: "a@b.com",
  role: "client" as const,
};

function okResponse() {
  return { ok: true, status: 200, json: async () => ({ data: sessionUser }) };
}
function unauthorizedResponse() {
  return { ok: false, status: 401, json: async () => ({}) };
}
function serverErrorResponse(status = 503) {
  return { ok: false, status, json: async () => ({}) };
}

describe("getServerSessionUser", () => {
  beforeEach(() => {
    meGet.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns the user on a clean 200", async () => {
    meGet.mockResolvedValueOnce(okResponse());
    await expect(getServerSessionUser()).resolves.toEqual(parsedSessionUser);
    expect(meGet).toHaveBeenCalledTimes(1);
  });

  it("returns null on a genuine 401 without retrying", async () => {
    meGet.mockResolvedValueOnce(unauthorizedResponse());
    await expect(getServerSessionUser()).resolves.toBeNull();
    expect(meGet).toHaveBeenCalledTimes(1);
  });

  it("retries a transient 5xx and succeeds (no false logout)", async () => {
    meGet.mockResolvedValueOnce(serverErrorResponse(503)).mockResolvedValueOnce(okResponse());
    await expect(getServerSessionUser()).resolves.toEqual(parsedSessionUser);
    expect(meGet).toHaveBeenCalledTimes(2);
  });

  it("retries a thrown network error then succeeds", async () => {
    meGet.mockRejectedValueOnce(new Error("ETIMEDOUT")).mockResolvedValueOnce(okResponse());
    await expect(getServerSessionUser()).resolves.toEqual(parsedSessionUser);
    expect(meGet).toHaveBeenCalledTimes(2);
  });

  it("falls back to null after exhausting retries on persistent 5xx", async () => {
    meGet.mockResolvedValue(serverErrorResponse(502));
    await expect(getServerSessionUser()).resolves.toBeNull();
    // initial attempt + 2 retries
    expect(meGet).toHaveBeenCalledTimes(3);
  });
});
