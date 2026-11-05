import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/data/http/hc-server", () => ({
  getServerApiBase: () => "http://127.0.0.1:3001",
}));
let bearer: string | null = null;
vi.mock("@/lib/data/http/server-request-headers", () => ({
  deriveSsrOrigin: async () => "https://lax.bid",
  withBidApiBearer: () => async (headers: Headers) => {
    if (bearer) headers.set("Authorization", `Bearer ${bearer}`);
  },
  ComposableServerRequestHeaders: class {
    constructor(private readonly decorators: Array<(h: Headers) => void | Promise<void>>) {}
    async build(init?: HeadersInit) {
      const headers = new Headers(init);
      for (const decorate of this.decorators) await decorate(headers);
      return headers;
    }
  },
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "1.2.3.4, 203.0.113.9, 10.0.0.1" }),
}));

const CLIENT_IP_TOKEN = "t".repeat(32);
process.env.API_SSR_CLIENT_IP_TOKEN = CLIENT_IP_TOKEN;

const { httpContactDispatcher } = await import("./http-contact-dispatcher.server");
const { ContactDispatchError } = await import("./contact-dispatcher");

const payload = {
  intent: "general" as const,
  topic: "press" as const,
  email: "ada@example.com",
  name: "Ada Lovelace",
  message: "A question about the next sale.",
  sourcePage: "/contact?intent=press",
};

describe("httpContactDispatcher", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    bearer = null;
  });

  it("posts the enquiry to the API with the public origin and the visitor's address", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { id: "enq-1", reference: "E-1042", replyBy: "2026-11-04T10:30:00.000Z" },
        }),
        { status: 201 },
      ),
    );

    const receipt = await httpContactDispatcher.dispatch(payload);

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("http://127.0.0.1:3001/contact-enquiries");
    expect(init?.method).toBe("POST");
    const sent = new Headers(init?.headers);
    expect(sent.get("content-type")).toBe("application/json");
    expect(sent.get("origin")).toBe("https://lax.bid");
    expect(sent.get("x-lax-client-ip")).toBe("203.0.113.9");
    expect(sent.get("x-lax-client-ip-token")).toBe(CLIENT_IP_TOKEN);
    expect(sent.get("x-forwarded-for")).toBeNull();
    expect(sent.get("authorization")).toBeNull();
    expect(JSON.parse(String(init?.body))).toEqual(payload);
    expect(receipt).toEqual({ reference: "E-1042", replyBy: "2026-11-04T10:30:00.000Z" });
  });

  it("sends a signed-in sender's session so the enquiry is linked to their account", async () => {
    bearer = "access-token";
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 201 }));
    await httpContactDispatcher.dispatch(payload);
    const sent = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(sent.get("authorization")).toBe("Bearer access-token");
  });

  it("starts a draft for a visitor's files", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ data: { draftToken: "a.b", expiresAt: "2026-11-03T10:00:00.000Z" } }),
          { status: 201 },
        ),
      );
    const draft = await httpContactDispatcher.startDraft();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://127.0.0.1:3001/contact-enquiries/drafts");
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBeUndefined();
    expect(draft).toEqual({ draftToken: "a.b", expiresAt: "2026-11-03T10:00:00.000Z" });
  });

  it("lists the organisations the sender may enquire for, with their session", async () => {
    bearer = "access-token";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ id: "e1", name: "Marlow", role: "owner", canBuy: true, canSell: true }],
        }),
        { status: 200 },
      ),
    );
    const list = await httpContactDispatcher.organisations();
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://127.0.0.1:3001/contact-enquiries/organisations",
    );
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("GET");
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get("authorization")).toBe(
      "Bearer access-token",
    );
    expect(list).toHaveLength(1);
  });

  it("carries the API's refusal code, so the page can say why", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ code: "organisation_not_permitted" }), { status: 403 }),
    );
    await expect(httpContactDispatcher.dispatch(payload)).rejects.toMatchObject({
      status: 403,
      code: "organisation_not_permitted",
    });
  });

  it("fails with the status when the API refuses the message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 429 }));

    const failure = await httpContactDispatcher.dispatch(payload).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ContactDispatchError);
    expect(failure).toMatchObject({ status: 429 });
  });

  it("fails when the API errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 500 }));
    await expect(httpContactDispatcher.dispatch(payload)).rejects.toMatchObject({ status: 500 });
  });

  it("fails when the API cannot be reached, never reporting success", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("fetch failed"));

    const failure = await httpContactDispatcher.dispatch(payload).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ContactDispatchError);
  });
});
