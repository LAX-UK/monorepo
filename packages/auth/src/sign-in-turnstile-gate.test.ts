import { describe, expect, it } from "vitest";
import { isSignInEmailPost } from "./sign-in-turnstile-gate.js";

describe("isSignInEmailPost", () => {
  it("matches Better Auth email sign-in path", () => {
    expect(
      isSignInEmailPost(
        new Request("https://api.example.com/api/auth/sign-in/email", { method: "POST" }),
      ),
    ).toBe(true);
  });

  it("ignores other routes", () => {
    expect(
      isSignInEmailPost(
        new Request("https://api.example.com/api/auth/session", { method: "POST" }),
      ),
    ).toBe(false);
  });
});
