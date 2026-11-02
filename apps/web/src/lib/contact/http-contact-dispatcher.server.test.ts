import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/data/http/hc-server", () => ({
  getServerApiBase: () => "http://127.0.0.1:3001",
}));
vi.mock("@/lib/data/http/server-request-headers", () => ({
  deriveSsrOrigin: async () => "https://lax.bid",
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }),
}));

const { httpContactDispatcher } = await import("./http-contact-dispatcher.server");
const { ContactDispatchError } = await import("./contact-dispatcher");

const payload = {
  topic: "press" as const,
  email: "ada@example.com",
  name: "Ada Lovelace",
  message: "A question about the next sale.",
  sourcePage: "/contact?intent=press",
};

describe("httpContactDispatcher", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("posts the enquiry to the API with the public origin and the visitor's address", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ data: { id: "enq-1" } }), { status: 201 }));

    await httpContactDispatcher.dispatch(payload);

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("http://127.0.0.1:3001/contact-enquiries");
    expect(init).toMatchObject({
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://lax.bid",
        "x-forwarded-for": "203.0.113.9",
      },
    });
    expect(JSON.parse(String(init?.body))).toEqual(payload);
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
