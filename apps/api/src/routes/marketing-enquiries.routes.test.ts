import { describe, expect, it, vi } from "vitest";
import type { ContainerMarketingEnquiryRoutesSlice } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import type { IRateLimitStore } from "../services/interfaces/rate-limit-store.js";
import { createMarketingEnquiryRoutes } from "./marketing-enquiries.js";

const valid = {
  name: "Ada Lovelace",
  email: "Ada@Example.com",
  topic: "selling",
  message: "I would like to sell a work privately.",
  sourcePage: "/contact?intent=private-sale",
};

function setup(
  store?: IRateLimitStore,
  session: { id: string; role: string; scopes?: string[] } | null = null,
) {
  const submit = vi.fn().mockResolvedValue({
    ok: true,
    id: "enq-1",
    reference: "E-1042",
    replyBy: "2026-11-04T10:30:00.000Z",
  });
  const rateLimitStore: IRateLimitStore = store ?? {
    increment: vi.fn().mockResolvedValue({ allowed: true, remaining: 4 }),
  };
  const issue = vi.fn().mockReturnValue({
    token: "draft.token",
    draftId: "d1",
    expiresAt: new Date("2026-11-03T10:00:00Z"),
  });
  const listFor = vi
    .fn()
    .mockResolvedValue([
      { id: "e1", name: "Marlow Collection Ltd", role: "owner", canBuy: true, canSell: true },
    ]);
  const authenticator = {
    getSessionUser: vi.fn().mockResolvedValue(session),
  } as unknown as IAuthenticator;
  const routes = createMarketingEnquiryRoutes(
    {
      rateLimitStore,
      enquirySubmission: { submit },
      enquiryDraftTokens: { issue },
      enquirerOrganisations: { listFor },
      userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    } as unknown as ContainerMarketingEnquiryRoutesSlice,
    authenticator,
  );
  const post = (body: unknown, headers: Record<string, string> = {}) =>
    routes.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
  return { submit, post, rateLimitStore, routes, issue, listFor };
}

describe("POST /contact-enquiries", () => {
  it("stores a valid enquiry and returns its id", async () => {
    const { post, submit } = setup();

    const res = await post(valid);

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      data: { id: "enq-1", reference: "E-1042", replyBy: "2026-11-04T10:30:00.000Z" },
    });
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ intent: "general", email: "ada@example.com", topic: "selling" }),
      null,
    );
  });

  it("accepts a private sale seller's structured enquiry", async () => {
    const { post, submit } = setup();
    const res = await post({
      intent: "private_sale_sell",
      name: "Ada Lovelace",
      email: "ada@example.com",
      departmentSlug: "modern-british",
      artist: "David Hockney",
      title: "Pool study",
      locationTown: "Bath",
      locationCountry: "United Kingdom",
      marketingOptIn: true,
    });
    expect(res.status).toBe(201);
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        intent: "private_sale_sell",
        departmentSlug: "modern-british",
        marketingOptIn: true,
      }),
      null,
    );
  });

  it("accepts a private sale buyer's structured enquiry", async () => {
    const { post, submit } = setup();
    const res = await post({
      intent: "private_sale_buy",
      name: "Charlotte Hale",
      email: "charlotte@example.com",
      lookingFor: "Post-war British painting",
      budgetBand: "50000_to_250000",
      timing: "urgent",
    });
    expect(res.status).toBe(201);
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ intent: "private_sale_buy" }),
      null,
    );
  });

  it("refuses a structured enquiry that leaves out what its path needs", async () => {
    const { post, submit } = setup();
    const res = await post({
      intent: "private_sale_sell",
      name: "Ada Lovelace",
      email: "ada@example.com",
    });
    expect(res.status).toBe(400);
    expect(submit).not.toHaveBeenCalled();
  });

  it("accepts a phone number when one is given", async () => {
    const { post, submit } = setup();
    await post({ ...valid, phone: "+44 20 7946 0000" });
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ phone: "+44 20 7946 0000" }),
      null,
    );
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

describe("POST /contact-enquiries as a signed-in sender", () => {
  const session = { id: "user-1", role: "client", staffRoles: [] };

  it("hands the sender's account to the submission", async () => {
    const { post, submit } = setup(undefined, session);
    const res = await post(valid, { Authorization: "Bearer token" });
    expect(res.status).toBe(201);
    expect(submit).toHaveBeenCalledWith(expect.anything(), { userId: "user-1", role: "client" });
  });

  it("carries on as a guest when no credential is sent", async () => {
    const { post, submit } = setup(undefined, session);
    await post(valid);
    expect(submit).toHaveBeenCalledWith(expect.anything(), null);
  });

  it("answers a refusal with its status and code, never a created enquiry", async () => {
    const { post, submit } = setup(undefined, { id: "staff-1", role: "staff" });
    submit.mockResolvedValue({
      ok: false,
      status: 403,
      code: "staff_cannot_enquire",
      error: "Staff accounts cannot send private sale enquiries.",
    });
    const res = await post(valid, { Authorization: "Bearer token" });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: "Staff accounts cannot send private sale enquiries.",
      code: "staff_cannot_enquire",
    });
  });
});

describe("POST /contact-enquiries/drafts", () => {
  it("gives a visitor a draft token and when it ends", async () => {
    const { routes } = setup();
    const res = await routes.request("/drafts", { method: "POST" });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      data: { draftToken: "draft.token", expiresAt: "2026-11-03T10:00:00.000Z" },
    });
  });

  it("is limited like the form, in a bucket of its own", async () => {
    const increment = vi
      .fn()
      .mockResolvedValue({ allowed: false, remaining: 0, retryAfterSec: 30 });
    const { routes, issue } = setup({ increment });
    const res = await routes.request("/drafts", {
      method: "POST",
      headers: { "x-forwarded-for": "203.0.113.9" },
    });
    expect(res.status).toBe(429);
    expect(increment).toHaveBeenCalledWith(
      expect.stringContaining("rl:contact-enquiry-draft:minute:"),
      5,
      60,
    );
    expect(issue).not.toHaveBeenCalled();
  });
});

describe("GET /contact-enquiries/organisations", () => {
  it("lists the organisations the signed-in person may enquire for", async () => {
    const { routes, listFor } = setup(undefined, {
      id: "user-1",
      role: "client",
      scopes: ["bid.read", "bid.write"],
    });
    const res = await routes.request("/organisations", {
      headers: { Authorization: "Bearer token" },
    });
    expect(res.status).toBe(200);
    expect(listFor).toHaveBeenCalledWith("user-1");
    expect(await res.json()).toEqual({
      data: [
        { id: "e1", name: "Marlow Collection Ltd", role: "owner", canBuy: true, canSell: true },
      ],
    });
  });

  it("needs a session", async () => {
    const { routes } = setup();
    const res = await routes.request("/organisations");
    expect(res.status).toBe(401);
  });
});
