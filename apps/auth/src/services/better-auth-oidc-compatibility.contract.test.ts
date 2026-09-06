import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const betterAuthRoot = resolve(dirname(require.resolve("better-auth")), "..");

async function sha256(path: string): Promise<string> {
  return createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
}

describe("Better Auth 1.6.22 OIDC compatibility contract", () => {
  it("pins the exact upstream implementation used by session claim interception", async () => {
    const packageJson = JSON.parse(
      await readFile(resolve(betterAuthRoot, "package.json"), "utf8"),
    ) as { version: string };
    expect(packageJson.version).toBe("1.6.22");
    await expect(
      sha256(resolve(betterAuthRoot, "dist/plugins/oidc-provider/index.mjs")),
    ).resolves.toBe("f197a47338d5fddc4c0fb53e078fe77e92e191e9c3e7f36a11cdb9fc434cd037");
    await expect(
      sha256(resolve(betterAuthRoot, "dist/plugins/oidc-provider/authorize.mjs")),
    ).resolves.toBe("d22b3eae8f557af7bd483ebf27ceff821f4221d78c92d6ddcbb919feb7ae4604");
  });

  it("pins the supported callback and authorize/token response assumptions", async () => {
    const [tokenSource, authorizeSource] = await Promise.all([
      readFile(resolve(betterAuthRoot, "dist/plugins/oidc-provider/index.mjs"), "utf8"),
      readFile(resolve(betterAuthRoot, "dist/plugins/oidc-provider/authorize.mjs"), "utf8"),
    ]);
    expect(tokenSource).toContain(
      "options.getAdditionalUserInfoClaim ? await options.getAdditionalUserInfoClaim(user, requestedScopes, client) : {}",
    );
    expect(tokenSource).toContain(
      'return ctx.json({\n\t\t\t\t\taccess_token: accessToken,\n\t\t\t\t\ttoken_type: "Bearer"',
    );
    expect(tokenSource).toContain(
      "await ctx.context.internalAdapter.consumeVerificationValue(code.toString())",
    );
    expect(tokenSource).toContain(
      "if (token.clientId !== client_id?.toString()) throw new APIError",
    );
    expect(tokenSource).toContain("if (options.requirePKCE && !code_verifier)");
    expect(tokenSource).toContain(
      '(value.codeChallengeMethod === "plain" ? code_verifier : await createHash("SHA-256", "base64urlnopad").digest(code_verifier)) !== value.codeChallenge',
    );
    expect(tokenSource).toContain("client_secret is required for confidential clients");
    expect(authorizeSource).toContain(
      'const allowedCodeChallengeMethods = options.allowPlainCodeChallengeMethod ? ["s256", "plain"] : ["s256"]',
    );
    expect(authorizeSource).toContain('redirectURIWithCode.searchParams.set("code", code)');
    expect(authorizeSource).toContain("return handleRedirect(redirectURIWithCode.toString())");
    expect(tokenSource).toContain('endSession: createAuthEndpoint("/oauth2/endsession"');
    expect(tokenSource).toMatch(/method:\s*\[\s*"GET",\s*"POST"\s*\]/);
    expect(tokenSource).toContain(
      "if (userId) await ctx.context.adapter.deleteMany({\n\t\t\t\t\t\tmodel: modelName.oauthAccessToken",
    );
    expect(tokenSource).toContain(
      "if (session) {\n\t\t\t\t\tawait ctx.context.internalAdapter.deleteSession(session.session.token)",
    );
  });
});
