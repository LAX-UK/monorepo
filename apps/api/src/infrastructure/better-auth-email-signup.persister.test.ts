import type { Auth } from "@auction/auth/server";
import { describe, expect, it, vi } from "vitest";
import { BetterAuthEmailSignupPersister } from "./better-auth-email-signup.persister.js";

describe("BetterAuthEmailSignupPersister", () => {
  it("passes absolute verify-email callbackURL on the web origin", async () => {
    const signUpEmail = vi.fn().mockResolvedValue({ user: { id: "u1" } });
    const auth = { api: { signUpEmail } } as unknown as Auth;
    const persister = new BetterAuthEmailSignupPersister(auth, "https://app.example.com/");

    const result = await persister.signUpEmail({
      name: "Ada Lovelace",
      email: "ada@example.com",
      password: "hunter2hunter2",
    });

    expect(result).toEqual({ ok: true, userId: "u1" });
    expect(signUpEmail).toHaveBeenCalledWith({
      body: {
        name: "Ada Lovelace",
        email: "ada@example.com",
        password: "hunter2hunter2",
        callbackURL: "https://app.example.com/verify-email?email=ada%40example.com",
      },
    });
  });

  it("strips trailing slash from web origin", async () => {
    const signUpEmail = vi.fn().mockResolvedValue({ user: { id: "u2" } });
    const auth = { api: { signUpEmail } } as unknown as Auth;
    const persister = new BetterAuthEmailSignupPersister(auth, "https://web.test");

    await persister.signUpEmail({
      name: "Bob",
      email: "bob+tag@example.com",
      password: "password12",
    });

    expect(signUpEmail).toHaveBeenCalledWith({
      body: expect.objectContaining({
        callbackURL: "https://web.test/verify-email?email=bob%2Btag%40example.com",
      }),
    });
  });
});
