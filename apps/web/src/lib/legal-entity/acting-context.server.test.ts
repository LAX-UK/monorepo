import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockGet = vi.fn();
const mockSet = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: mockGet,
    set: mockSet,
  })),
}));

const mockAuthedFetch = vi.fn();

vi.mock("@/lib/data/http/authed-fetch.server", () => ({
  authedServerFetch: (...args: unknown[]) => mockAuthedFetch(...args),
}));

import { resolveActingContext } from "./acting-context.server";

describe("resolveActingContext cookie writes", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockSet.mockReset();
    mockAuthedFetch.mockReset();
    mockSet.mockImplementation(() => {
      throw new Error("Cookies can only be modified in a Server Action or Route Handler");
    });
  });

  it("swallows read-only cookie store errors when seeding acting entity", async () => {
    mockAuthedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: "le-1",
            displayName: "Personal",
            kind: "individual",
            subkind: "private_collector",
            status: "lead",
            role: "owner",
            isPrimaryAdmin: true,
          },
        ],
      }),
    });
    mockGet.mockReturnValue(undefined);

    await expect(resolveActingContext("client", null)).resolves.toMatchObject({
      acting: expect.objectContaining({ id: "le-1" }),
      memberships: expect.arrayContaining([expect.objectContaining({ id: "le-1" })]),
    });
  });
});
