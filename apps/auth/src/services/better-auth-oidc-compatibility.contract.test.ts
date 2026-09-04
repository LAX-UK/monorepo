import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const betterAuthRoot = resolve(import.meta.dirname, "../../../../node_modules/better-auth");

async function sha256(path: string): Promise<string> {
  return createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
}

describe("Better Auth 1.6.9 OIDC compatibility contract", () => {
  it("pins the exact upstream implementation used by session claim interception", async () => {
    const packageJson = JSON.parse(
      await readFile(resolve(betterAuthRoot, "package.json"), "utf8"),
    ) as { version: string };
    expect(packageJson.version).toBe("1.6.9");
    await expect(
      sha256(resolve(betterAuthRoot, "dist/plugins/oidc-provider/index.mjs")),
    ).resolves.toBe("924d063a2aeb658c8e37aa7681951183bbf1c3eacd6d073c87b51492f0b57bc3");
    await expect(
      sha256(resolve(betterAuthRoot, "dist/plugins/oidc-provider/authorize.mjs")),
    ).resolves.toBe("2e0b17cf2a2121cb86f05da13392d8190545cebc34866cc9ad1c951215cc162f");
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
      "await ctx.context.internalAdapter.deleteVerificationByIdentifier(code.toString())",
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
