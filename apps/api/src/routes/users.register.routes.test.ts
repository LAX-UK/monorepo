import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import { createUserRoutes } from "./users.js";

function mountRegister(overrides?: Partial<Container>) {
  const registrationService = {
    register: vi.fn().mockResolvedValue({ ok: true, userId: "user-new" }),
  };
  const marketingEventService = {
    emit: vi.fn().mockResolvedValue(undefined),
  };
  const container = {
    env: { WEB_ORIGIN: "https://test.lax.bid" },
    registrationService,
    marketingEventService,
    ...overrides,
  } as unknown as Container;
  const app = new Hono();
  app.route(
    "/users",
    createUserRoutes(container, {
      getSessionUser: vi.fn(),
    } as never),
  );
  return { app, registrationService, marketingEventService };
}

describe("POST /users/register", () => {
  it("returns 201-equivalent success with user id", async () => {
    const { app, registrationService } = mountRegister();
    const res = await app.request("/users/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
        password: "supersecret12!",
        persona: "individual",
        acceptTerms: true,
      }),
    });
    expect(res.status).toBe(201);
    expect(registrationService.register).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
        persona: "individual",
      }),
    );
  });

  it("returns registration error from service", async () => {
    const { app } = mountRegister({
      registrationService: {
        register: vi.fn().mockResolvedValue({
          ok: false,
          message: "Email already registered",
          status: 400,
        }),
      },
    } as unknown as Partial<Container>);
    const res = await app.request("/users/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "Ada",
        lastName: "Lovelace",
        email: "taken@example.com",
        password: "supersecret12!",
        persona: "individual",
        acceptTerms: true,
      }),
    });
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("Email already registered");
  });

  it("returns 503 when registration is disabled", async () => {
    const { app } = mountRegister({
      env: { DISABLE_NEW_USER_REGISTRATION: true, WEB_ORIGIN: "https://test.lax.bid" },
    } as Partial<Container>);
    const res = await app.request("/users/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
        password: "supersecret12!",
        persona: "individual",
        acceptTerms: true,
      }),
    });
    expect(res.status).toBe(503);
    const json = (await res.json()) as { code: string };
    expect(json.code).toBe("registration_disabled");
  });
});
