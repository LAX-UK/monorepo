import { describe, expect, it, vi } from "vitest";
import type { ContainerMarketingEnquiryRoutesSlice } from "../container.js";
import type { IRateLimitStore } from "../services/interfaces/rate-limit-store.js";
import { createMarketingEnquiryRoutes } from "./marketing-enquiries.js";

const valid = {
  name: "Ada Lovelace",
  email: "Ada@Example.com",
  topic: "selling",
  message: "I would like to sell a work privately.",
  sourcePage: "/contact?intent=private-sale",
};

function setup(store?: IRateLimitStore) {
  const submit = vi.fn().mockResolvedValue({ id: "enq-1" });
  const rateLimitStore: IRateLimitStore = store ?? {
    increment: vi.fn().mockResolvedValue({ allowed: true, remaining: 4 }),
  };
  const routes = createMarketingEnquiryRoutes({
    rateLimitStore,
    marketingEnquiryService: { submit },
  } as unknown as ContainerMarketingEnquiryRoutesSlice);
  const post = (body: unknown, headers: Record<string, string> = {}) =>
    routes.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
  return { submit, post, rateLimitStore };
}

describe("POST /contact-enquiries", () => {
  it("stores a valid enquiry and returns its id", async () => {
    const { post, submit } = setup();

    const res = await post(valid);

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ data: { id: "enq-1" } });
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ email: "ada@example.com", topic: "selling" }),
    );
  });

  it("accepts a phone number when one is given", async () => {
    const { post, submit } = setup();
    await post({ ...valid, phone: "+44 20 7946 0000" });
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ phone: "+44 20 7946 0000" }));
  });

  it.each([
    ["a missing name", { ...valid, name: "" }],
    ["a bad email", { ...valid, email: "not-an-email" }],
    ["an unknown topic", { ...valid, topic: "gossip" }],
    ["a message under ten characters", { ...valid, message: "Hi" }],
    ["a message over 5000 characters", { ...valid, message: "x".repeat(5001) }],
    ["a source page that is not a path", { ...valid, sourcePage: "https://elsewhere.test" }],
  ])("rejects %s without storing anything", async (_label, body) => {
    const { post, submit } = setup();

    const res = await post(body);

    expect(res.status).toBe(400);
    expect(submit).not.toHaveBeenCalled();
  });

  it("limits each client address and tells the caller when to retry", async () => {
    const increment = vi
      .fn()
      .mockResolvedValue({ allowed: false, remaining: 0, retryAfterSec: 30 });
    const { post, submit } = setup({ increment });

    const res = await post(valid, { "x-forwarded-for": "203.0.113.9" });

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
    expect(await res.json()).toMatchObject({ code: "rate_limited" });
    expect(increment).toHaveBeenCalledWith(
      expect.stringContaining("rl:contact-enquiry:minute:"),
      5,
      60,
    );
    expect(submit).not.toHaveBeenCalled();
  });

  it("still takes the enquiry when the limit store is unavailable", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { post, submit } = setup({
      increment: vi.fn().mockRejectedValue(new Error("redis down")),
    });

    const res = await post(valid);

    expect(res.status).toBe(201);
    expect(submit).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
