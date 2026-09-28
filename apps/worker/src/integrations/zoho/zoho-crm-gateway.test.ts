import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkerEnv } from "../../env.js";
import { invalidateZohoCrmAccessToken } from "./oauth-token-refresh.js";
import type { ZohoCrmHttpError } from "./types.js";
import { ZohoCrmGateway } from "./zoho-crm-gateway.js";

vi.mock("./oauth-token-refresh.js", () => ({
  getZohoCrmAccessToken: vi.fn().mockResolvedValue("token-abc"),
  invalidateZohoCrmAccessToken: vi.fn(),
}));

function env(): WorkerEnv {
  return {
    ZOHO_CLIENT_ID: "id",
    ZOHO_CLIENT_SECRET: "secret",
    ZOHO_REFRESH_TOKEN: "refresh",
    ZOHO_ACCOUNTS_HOST: "https://accounts.zoho.eu",
    ZOHO_CRM_API_HOST: "https://www.zohoapis.eu",
  } as WorkerEnv;
}

describe("ZohoCrmGateway", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        text: async () => "",
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("retries once on 401 after invalidating the token cache", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers(),
        text: async () => "unauthorized",
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "X-API-CREDITS-REMAINING": "42" }),
        text: async () =>
          JSON.stringify({
            data: [{ status: "success", details: { id: "lead-1" }, code: "SUCCESS" }],
          }),
      } as Response);

    const gateway = new ZohoCrmGateway(env(), { apiHost: "https://www.zohoapis.eu/", trigger: [] });
    const result = await gateway.upsert({
      module: "Leads",
      fields: { Email: "a@b.com" },
      duplicateCheckFields: ["Email"],
    });

    expect(invalidateZohoCrmAccessToken).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.status).toBe("success");
    expect(gateway.getMetrics().apiCreditsRemaining).toBe(42);
  });

  it("throws ZohoCrmHttpError with retryAfterMs on upsert 429", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers({ "Retry-After": "15" }),
      text: async () => "too many",
    } as Response);

    const gateway = new ZohoCrmGateway(env(), { apiHost: "https://www.zohoapis.eu/", trigger: [] });
    await expect(
      gateway.upsert({
        module: "Leads",
        fields: { Email: "a@b.com" },
        duplicateCheckFields: ["Email"],
      }),
    ).rejects.toMatchObject({
      status: 429,
      retryAfterMs: 15_000,
    });
  });

  it("throws ZohoCrmHttpError with retryAfterMs on 429 coql", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers({ "Retry-After": "30" }),
      text: async () => "too many",
    } as Response);

    const gateway = new ZohoCrmGateway(env(), { apiHost: "https://www.zohoapis.eu/", trigger: [] });
    await expect(gateway.executeCoql("select id from Leads where id = '1'")).rejects.toMatchObject({
      status: 429,
      retryAfterMs: 30_000,
    } satisfies Partial<ZohoCrmHttpError>);
  });

  it("treats recycle bin 404 as success", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 404,
      headers: new Headers(),
      text: async () => "not found",
    } as Response);

    const gateway = new ZohoCrmGateway(env(), { apiHost: "https://www.zohoapis.eu/", trigger: [] });
    await expect(gateway.purgeFromRecycleBin("rec-1")).resolves.toBeUndefined();
  });

  it("parses convert response contact id object shape", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      text: async () =>
        JSON.stringify({
          data: [
            {
              Contacts: { id: "contact-99", name: "A B" },
              status: "success",
            },
          ],
        }),
    } as Response);

    const gateway = new ZohoCrmGateway(env(), { apiHost: "https://www.zohoapis.eu/", trigger: [] });
    const result = await gateway.convertLead({ leadId: "lead-1" });
    expect(result.contactId).toBe("contact-99");
  });
});
