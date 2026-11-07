import { describe, expect, it, vi } from "vitest";
import type { WorkerEnv } from "../../../env.js";
import {
  CAMPAIGNS_LIST_PATH,
  type CampaignsHttpGet,
  HttpZohoCampaignsContactSource,
} from "./zoho-campaigns-contact-source.js";

const env = {
  ZOHO_API_HOST: "https://www.zohoapis.eu",
  ZOHO_CAMPAIGNS_LIST_KEY: "list-1",
} as WorkerEnv;

describe("HttpZohoCampaignsContactSource", () => {
  it("reads one page with a GET and the OAuth token, and never writes", async () => {
    const get = vi.fn<CampaignsHttpGet>(async () => ({
      status: 200,
      body: { list_of_details: [{ contact_email: "a@example.com" }, "junk"] },
    }));
    const source = new HttpZohoCampaignsContactSource(env, get, async () => "tok");

    const rows = await source.listContacts("unsubscribed", { offset: 200, limit: 200 });

    expect(rows).toEqual([{ contact_email: "a@example.com" }]);
    const [url, headers] = get.mock.calls[0] ?? [];
    expect(url?.pathname).toBe(CAMPAIGNS_LIST_PATH);
    expect(url?.searchParams.get("status")).toBe("unsub");
    expect(url?.searchParams.get("listkey")).toBe("list-1");
    expect(url?.searchParams.get("fromindex")).toBe("201");
    expect(headers).toEqual({ Authorization: "Zoho-oauthtoken tok" });
  });

  it("asks for the bounced list for bounces", async () => {
    const get = vi.fn<CampaignsHttpGet>(async () => ({ status: 200, body: {} }));
    const source = new HttpZohoCampaignsContactSource(env, get, async () => "tok");
    expect(await source.listContacts("bounced", { offset: 0, limit: 10 })).toEqual([]);
    expect(get.mock.calls[0]?.[0].searchParams.get("status")).toBe("bounce");
  });

  it("fails on a non-2xx answer and when OAuth is not configured", async () => {
    const failing = new HttpZohoCampaignsContactSource(
      env,
      async () => ({ status: 500, body: null }),
      async () => "tok",
    );
    await expect(failing.listContacts("bounced", { offset: 0, limit: 10 })).rejects.toThrow(
      "zoho_campaigns_list_failed_500",
    );
    const noAuth = new HttpZohoCampaignsContactSource(env, vi.fn(), async () => null);
    await expect(noAuth.listContacts("bounced", { offset: 0, limit: 10 })).rejects.toThrow(
      "zoho_campaigns_oauth_not_configured",
    );
  });
});
