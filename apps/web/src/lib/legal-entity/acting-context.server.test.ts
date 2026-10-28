import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockGet = vi.fn();
const mockSet = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: mockGet,
    set: mockSet,
  })),
  headers: vi.fn(async () => new Headers({ host: "lax.bid" })),
}));

const mockAuthedFetch = vi.fn();

vi.mock("@/lib/data/http/authed-fetch.server", () => ({
  authedServerFetch: (...args: unknown[]) => mockAuthedFetch(...args),
}));

import { resolveActingContext } from "./acting-context.server";

const PERSONAL = {
  id: "11111111-1111-4111-8111-111111111111",
  displayName: "Personal",
  kind: "individual",
  subkind: "private_collector",
  status: "lead",
  role: "owner",
  isPrimaryAdmin: true,
};

const ORG = {
  id: "22222222-2222-4222-8222-222222222222",
  displayName: "Gallery One",
  kind: "organisation",
  subkind: "gallery",
  status: "approved",
  role: "owner",
  isPrimaryAdmin: true,
};

describe("resolveActingContext", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockSet.mockReset();
    mockAuthedFetch.mockReset();
    mockSet.mockImplementation(() => {
      throw new Error("Cookies can only be modified in a Server Action or Route Handler");
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("acts as personal on a new device, never writes the cookie, and asks for a restore", async () => {
    mockAuthedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [PERSONAL] }),
    });
    mockGet.mockReturnValue(undefined);

    await expect(resolveActingContext("client", [])).resolves.toMatchObject({
      acting: expect.objectContaining({ id: "11111111-1111-4111-8111-111111111111" }),
      memberships: expect.arrayContaining([
        expect.objectContaining({ id: "11111111-1111-4111-8111-111111111111" }),
      ]),
      needsRestore: true,
    });
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("asks for a restore when the cookie names an organisation the person left", async () => {
    mockAuthedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [PERSONAL] }),
    });
    mockGet.mockReturnValue({ value: ORG.id });

    await expect(resolveActingContext("client", [])).resolves.toMatchObject({
      acting: expect.objectContaining({ id: PERSONAL.id }),
      needsRestore: true,
    });
  });

  it("keeps org acting from cookie when org module is enabled", async () => {
    mockAuthedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [PERSONAL, ORG] }),
    });
    mockGet.mockReturnValue({ value: "22222222-2222-4222-8222-222222222222" });

    await expect(resolveActingContext("client", [])).resolves.toMatchObject({
      acting: expect.objectContaining({
        id: "22222222-2222-4222-8222-222222222222",
        kind: "organisation",
      }),
      needsRestore: false,
    });
  });

  it("falls back to personal when org cookie set but kill switch is on", async () => {
    vi.stubEnv("NEXT_PUBLIC_FORCE_ORG_MODULE", "hidden");
    mockAuthedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [PERSONAL, ORG] }),
    });
    mockGet.mockReturnValue({ value: "22222222-2222-4222-8222-222222222222" });

    await expect(resolveActingContext("client", [])).resolves.toMatchObject({
      acting: expect.objectContaining({
        id: "11111111-1111-4111-8111-111111111111",
        kind: "individual",
      }),
    });
  });

  it("keeps personal acting unchanged when kill switch is on", async () => {
    vi.stubEnv("NEXT_PUBLIC_FORCE_ORG_MODULE", "hidden");
    mockAuthedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [PERSONAL, ORG] }),
    });
    mockGet.mockReturnValue({ value: "11111111-1111-4111-8111-111111111111" });

    await expect(resolveActingContext("client", [])).resolves.toMatchObject({
      acting: expect.objectContaining({
        id: "11111111-1111-4111-8111-111111111111",
        kind: "individual",
      }),
    });
  });
});
