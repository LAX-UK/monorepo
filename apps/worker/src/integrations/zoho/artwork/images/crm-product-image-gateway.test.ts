import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkerEnv } from "../../../../env.js";
import { invalidateZohoCrmAccessToken } from "../../oauth-token-refresh.js";
import { CrmProductImageGateway } from "./crm-product-image-gateway.js";
import { ZohoImageFetchError } from "./zoho-product-image.js";

vi.mock("../../oauth-token-refresh.js", () => ({
  getZohoCrmAccessToken: vi.fn().mockResolvedValue("token-abc"),
  invalidateZohoCrmAccessToken: vi.fn(),
}));

// Shapes follow Zoho CRM v8's Products record, Attachments list and file download responses.
const dir = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const fixture = (name: string) => readFileSync(join(dir, name), "utf8");
const json = (name: string, init: ResponseInit = {}) =>
  new Response(fixture(name), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });

type Route = (url: URL) => Response | Promise<Response>;

function gatewayFor(route: Route) {
  const fetchFn = vi.fn(async (input: URL, _init?: RequestInit) => route(new URL(String(input))));
  const sleep = vi.fn(async () => undefined);
  const gateway = new CrmProductImageGateway({} as WorkerEnv, {
    apiHost: "https://www.zohoapis.eu",
    fetchFn: fetchFn as never,
    sleep,
  });
  return { gateway, fetchFn, sleep };
}

afterEach(() => vi.clearAllMocks());

describe("CrmProductImageGateway.listImages", () => {
  const listRoute: Route = (url) => {
    if (url.pathname.endsWith("/Attachments")) {
      return url.searchParams.get("page") === "2"
        ? json("attachments-page-2.json")
        : json("attachments-page-1.json");
    }
    return json("product-record-image.json");
  };

  it("lists the record image first, then image attachments oldest first, across pages", async () => {
    const { gateway, fetchFn } = gatewayFor(listRoute);
    const images = await gateway.listImages("5000000000001000001");

    expect(images.map((i) => [i.origin, i.fileId, i.fileName])).toEqual([
      ["record_image", "record_image", null],
      ["attachment", "5000000000009000020", "front.jpg"],
      ["attachment", "5000000000009000030", "side-view.PNG"],
      ["attachment", "5000000000009000050", "detail.webp"],
    ]);
    // The PDF and the attachment with no file name are not pictures.
    expect(images.some((i) => i.fileName === "condition-report.pdf")).toBe(false);

    const urls = fetchFn.mock.calls.map(([u]) => new URL(String(u)));
    expect(urls[0]?.pathname).toBe("/crm/v8/Products/5000000000001000001");
    expect(urls[0]?.searchParams.get("fields")).toBe("Record_Image");
    expect(urls[1]?.pathname).toBe("/crm/v8/Products/5000000000001000001/Attachments");
    expect(urls[1]?.searchParams.get("fields")).toContain("File_Name");
    expect(urls[2]?.searchParams.get("page")).toBe("2");
  });

  it("changes the fingerprint when Zoho's file changes", async () => {
    const { gateway } = gatewayFor(listRoute);
    const images = await gateway.listImages("p");
    expect(images.find((i) => i.fileId === "5000000000009000020")?.fingerprint).toBe(
      "1048576:2026-10-04T08:00:00+00:00",
    );
    expect(images[0]?.fingerprint).toBe(
      "ea0e7bf2c9a64d1c8c1e0c1f4b3d2a99d1f7c5e8b2a64f0d9e3c7a1b5d8f2e46",
    );
  });

  it("returns no pictures when the Product has no image and no attachments", async () => {
    const { gateway } = gatewayFor((url) =>
      url.pathname.endsWith("/Attachments")
        ? new Response(null, { status: 204 })
        : json("product-record-image-empty.json"),
    );
    expect(await gateway.listImages("p")).toEqual([]);
  });

  it("sends the Zoho token and never follows an image URL held in Zoho", async () => {
    const { gateway, fetchFn } = gatewayFor(listRoute);
    await gateway.listImages("p");
    for (const [url, init] of fetchFn.mock.calls) {
      expect(new URL(String(url)).host).toBe("www.zohoapis.eu");
      expect(init?.headers).toMatchObject({
        Authorization: "Zoho-oauthtoken token-abc",
      });
    }
  });

  it("fails as unavailable, so the register keeps its pictures, when Zoho keeps erroring", async () => {
    const { gateway, fetchFn, sleep } = gatewayFor(() => new Response("", { status: 503 }));
    await expect(gateway.listImages("p")).rejects.toMatchObject({
      reason: "unavailable",
      retryable: true,
    });
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalled();
  });

  it("treats a Product Zoho does not know as unavailable-for-good, not as having no pictures", async () => {
    const { gateway } = gatewayFor(() => new Response("{}", { status: 404 }));
    await expect(gateway.listImages("p")).rejects.toMatchObject({ retryable: false });
  });
});

describe("CrmProductImageGateway retries", () => {
  it("waits as long as Retry-After says when rate limited, then succeeds", async () => {
    let calls = 0;
    const { gateway, sleep } = gatewayFor((url) => {
      if (url.pathname.endsWith("/Attachments")) return new Response(null, { status: 204 });
      calls += 1;
      return calls === 1
        ? new Response("", { status: 429, headers: { "Retry-After": "7" } })
        : json("product-record-image-empty.json");
    });
    await gateway.listImages("p");
    expect(sleep).toHaveBeenCalledWith(7000);
  });

  it("refreshes the token once on 401 and then carries on", async () => {
    let first = true;
    const { gateway } = gatewayFor((url) => {
      if (first) {
        first = false;
        return new Response("", { status: 401 });
      }
      return url.pathname.endsWith("/Attachments")
        ? new Response(null, { status: 204 })
        : json("product-record-image-empty.json");
    });
    await expect(gateway.listImages("p")).resolves.toEqual([]);
    expect(invalidateZohoCrmAccessToken).toHaveBeenCalledTimes(1);
  });

  it("retries a network failure", async () => {
    let first = true;
    const { gateway } = gatewayFor((url) => {
      if (first) {
        first = false;
        throw new TypeError("fetch failed");
      }
      return url.pathname.endsWith("/Attachments")
        ? new Response(null, { status: 204 })
        : json("product-record-image-empty.json");
    });
    await expect(gateway.listImages("p")).resolves.toEqual([]);
  });
});

describe("CrmProductImageGateway.downloadImage", () => {
  const record = { fileId: "record_image", fingerprint: "x", origin: "record_image" as const };
  const attachment = {
    fileId: "5000000000009000020",
    fingerprint: "x",
    origin: "attachment" as const,
    fileName: "front.jpg",
  };
  const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

  it("downloads the record image from the photo endpoint", async () => {
    const { gateway, fetchFn } = gatewayFor(() => new Response(bytes, { status: 200 }));
    const got = await gateway.downloadImage("p1", { ...record, fileName: null }, 1000);
    expect(got.equals(bytes)).toBe(true);
    expect(new URL(String(fetchFn.mock.calls[0]?.[0])).pathname).toBe("/crm/v8/Products/p1/photo");
  });

  it("downloads an attachment by its id", async () => {
    const { gateway, fetchFn } = gatewayFor(() => new Response(bytes, { status: 200 }));
    await gateway.downloadImage("p1", attachment, 1000);
    expect(new URL(String(fetchFn.mock.calls[0]?.[0])).pathname).toBe(
      "/crm/v8/Products/p1/Attachments/5000000000009000020",
    );
  });

  it("refuses a file larger than the limit, by its declared size and by what arrives", async () => {
    const declared = gatewayFor(
      () => new Response(bytes, { status: 200, headers: { "Content-Length": "5000" } }),
    );
    await expect(declared.gateway.downloadImage("p", attachment, 100)).rejects.toMatchObject({
      reason: "too_large",
      retryable: false,
    });
    const streamed = gatewayFor(() => new Response(Buffer.alloc(500), { status: 200 }));
    await expect(streamed.gateway.downloadImage("p", attachment, 100)).rejects.toBeInstanceOf(
      ZohoImageFetchError,
    );
  });

  it("says not found for a missing file and unavailable for a server error", async () => {
    const missing = gatewayFor(() => new Response(null, { status: 204 }));
    await expect(missing.gateway.downloadImage("p", attachment, 100)).rejects.toMatchObject({
      reason: "not_found",
      retryable: false,
    });
    const broken = gatewayFor(() => new Response("", { status: 500 }));
    await expect(broken.gateway.downloadImage("p", attachment, 100)).rejects.toMatchObject({
      reason: "unavailable",
      retryable: true,
    });
  });
});
