import { describe, expect, it, vi } from "vitest";
import { IdentityBearerAuth } from "./export-request-auth.js";
import { decideFailure } from "./failure-policy.js";
import { SubjectExportError } from "./subject-export.errors.js";

function auth(response: Response): IdentityBearerAuth {
  return new IdentityBearerAuth({
    baseUrl: "https://identity.example.test/",
    clientId: "client",
    clientSecret: "not-a-real-secret",
    fetchImpl: vi.fn().mockResolvedValue(response),
  });
}

async function tokenError(response: Response): Promise<SubjectExportError> {
  const error = await auth(response)
    .headers(new AbortController().signal)
    .then(() => null)
    .catch((err: unknown) => err);
  if (!(error instanceof SubjectExportError)) throw new Error("expected a SubjectExportError");
  return error;
}

describe("IdentityBearerAuth token errors", () => {
  it("treats a 504 from Identity's token endpoint as transient", async () => {
    const error = await tokenError(new Response("<html>Gateway Timeout</html>", { status: 504 }));
    expect(error.code).toBe("identity_token_504");
    expect(error.kind).toBe("transient");
  });

  it("retries it while attempts and the 72-hour window remain", async () => {
    const error = await tokenError(new Response("", { status: 504 }));
    expect(decideFailure({ error, elapsedMs: 60_000, attempt: 1, maxAttempts: 13 })).toEqual({
      action: "retry",
    });
    expect(
      decideFailure({ error, elapsedMs: 60 * 3_600_000, attempt: 12, maxAttempts: 13 }),
    ).toEqual({ action: "retry" });
  });

  it("fails only once the attempts are spent", async () => {
    const error = await tokenError(new Response("", { status: 504 }));
    expect(
      decideFailure({ error, elapsedMs: 71 * 3_600_000, attempt: 13, maxAttempts: 13 }),
    ).toEqual({ action: "fail" });
  });

  it("uses the token Identity issues", async () => {
    const headers = await auth(
      new Response(JSON.stringify({ access_token: "tok", expires_in: 300 }), { status: 200 }),
    ).headers(new AbortController().signal);
    expect(headers).toEqual({ authorization: "Bearer tok" });
  });
});
