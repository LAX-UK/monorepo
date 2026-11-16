import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const OLD_TOKEN = "a".repeat(43);
const ENGINE_TOKEN = `${"e".repeat(60)}.${"f".repeat(43)}`;

afterEach(() => vi.unstubAllGlobals());

function stubShopApi(response: Response | Error) {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
    if (response instanceof Error) throw response;
    return response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const open = (token: string) =>
  GET(new NextRequest(`https://shop.lax.test/alerts/unsubscribe?token=${token}`));

describe("old edition alert link, GET", () => {
  it("only reads: one GET lookup, then a redirect to the shared stop page to confirm", async () => {
    const fetchMock = stubShopApi(
      new Response(JSON.stringify({ token: ENGINE_TOKEN }), { status: 200 }),
    );
    const response = await open(OLD_TOKEN);
    expect(response.status).toBe(303);
    const target = new URL(response.headers.get("location") ?? "");
    expect(target.pathname).toBe("/release-alerts/stop");
    expect(target.searchParams.get("token")).toBe(ENGINE_TOKEN);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/v1/alerts/unsubscribe/engine-link?");
    expect(fetchMock.mock.calls[0]?.[1]?.method ?? "GET").toBe("GET");
  });

  it("keeps the old confirm page for a link with no engine row, or when the lookup fails", async () => {
    stubShopApi(new Response("{}", { status: 404 }));
    let target = new URL((await open(OLD_TOKEN)).headers.get("location") ?? "");
    expect(target.pathname).toBe("/alerts/stop");
    expect(target.searchParams.get("token")).toBe(OLD_TOKEN);

    stubShopApi(new Error("network down"));
    target = new URL((await open(OLD_TOKEN)).headers.get("location") ?? "");
    expect(target.pathname).toBe("/alerts/stop");
  });

  it("asks nothing for a malformed token", async () => {
    const fetchMock = stubShopApi(new Response("{}", { status: 200 }));
    const target = new URL((await open("short")).headers.get("location") ?? "");
    expect(target.pathname).toBe("/alerts/stop");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
