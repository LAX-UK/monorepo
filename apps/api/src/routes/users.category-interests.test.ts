import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createTestUserRouteServices } from "../testing/create-test-user-route-services.js";
import { createUserRoutes } from "./users.js";

const categoryId = "11111111-1111-4111-8111-111111111111";

function createApp(input?: {
  sessionUser?: { id: string; role: "client" } | null;
  repository?: {
    getForUser: ReturnType<typeof vi.fn>;
    replace: ReturnType<typeof vi.fn>;
    replaceAndComplete: ReturnType<typeof vi.fn>;
  };
  profile?: {
    role: string;
    suspended: boolean;
    emailVerified: boolean;
    signupPersona: "individual" | "organisation" | null;
  } | null;
}) {
  const repository = input?.repository ?? {
    getForUser: vi.fn().mockResolvedValue({
      categoryIds: [categoryId],
      onboardingCompletedAt: new Date("2026-08-20T12:00:00.000Z"),
    }),
    replace: vi.fn().mockResolvedValue({
      ok: true,
      state: {
        categoryIds: [categoryId],
        onboardingCompletedAt: new Date("2026-08-20T12:00:00.000Z"),
      },
    }),
    replaceAndComplete: vi.fn().mockResolvedValue({
      ok: true,
      state: {
        categoryIds: [categoryId],
        onboardingCompletedAt: new Date("2026-08-20T12:00:00.000Z"),
      },
    }),
  };
  const container = {
    userRoutes: createTestUserRouteServices({
      categoryInterestsRepository: repository as never,
      profileService: {
        getProfile: vi.fn().mockResolvedValue(
          input && "profile" in input
            ? input.profile
            : {
                role: "client",
                suspended: false,
                emailVerified: true,
                signupPersona: "individual",
              },
        ),
      } as never,
    }),
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
  } as unknown as Container;
  const authenticator: IAuthenticator = {
    getSessionUser: vi
      .fn()
      .mockResolvedValue(
        input && "sessionUser" in input ? input.sessionUser : { id: "u1", role: "client" },
      ),
  };
  const app = new Hono();
  app.route("/users", createUserRoutes(container, authenticator));
  return { app, repository };
}

describe("GET /users/me/category-interests", () => {
  it("returns the authenticated user's ordered interests and completion marker", async () => {
    const { app, repository } = createApp();
    const response = await app.request("/users/me/category-interests");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: {
        categoryIds: [categoryId],
        onboardingCompleted: true,
        onboardingCompletedAt: "2026-08-20T12:00:00.000Z",
      },
    });
    expect(repository.getForUser).toHaveBeenCalledWith("u1");
  });

  it("requires authentication", async () => {
    const { app } = createApp({ sessionUser: null });
    expect((await app.request("/users/me/category-interests")).status).toBe(401);
  });
});

describe("PUT /users/me/category-interests", () => {
  it("replaces interests and completes onboarding, including an empty selection", async () => {
    const { app, repository } = createApp();
    const response = await app.request("/users/me/category-interests", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ categoryIds: [] }),
    });

    expect(response.status).toBe(200);
    expect(repository.replaceAndComplete).toHaveBeenCalledWith("u1", []);
  });

  it("rejects malformed and unknown categories", async () => {
    const repository = {
      getForUser: vi.fn(),
      replace: vi.fn(),
      replaceAndComplete: vi.fn().mockResolvedValue({
        ok: false,
        invalidCategoryIds: [categoryId],
      }),
    };
    const { app } = createApp({ repository });
    const malformed = await app.request("/users/me/category-interests", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ categoryIds: ["invalid"] }),
    });
    expect(malformed.status).toBe(400);
    expect(repository.replaceAndComplete).not.toHaveBeenCalled();

    const unknown = await app.request("/users/me/category-interests", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ categoryIds: [categoryId] }),
    });
    expect(unknown.status).toBe(422);
    expect(await unknown.json()).toEqual({
      error: "One or more categories do not exist",
      code: "category_interests_invalid_category",
      invalidCategoryIds: [categoryId],
    });
  });

  it.each([
    { role: "staff", suspended: false, emailVerified: true, signupPersona: "individual" as const },
    {
      role: "client",
      suspended: false,
      emailVerified: true,
      signupPersona: "organisation" as const,
    },
  ])("rejects an ineligible account before writing interests", async (profile) => {
    const { app, repository } = createApp({ profile });
    const response = await app.request("/users/me/category-interests", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ categoryIds: [] }),
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "category_interests_not_eligible" });
    expect(repository.replaceAndComplete).not.toHaveBeenCalled();
  });
});

describe("PUT /users/me/category-interests/preferences", () => {
  it("replaces interests without completing onboarding", async () => {
    const { app, repository } = createApp();
    const response = await app.request("/users/me/category-interests/preferences", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ categoryIds: [categoryId] }),
    });

    expect(response.status).toBe(200);
    expect(repository.replace).toHaveBeenCalledWith("u1", [categoryId]);
    expect(repository.replaceAndComplete).not.toHaveBeenCalled();
  });
});
