import { Hono } from "hono";
import type { ContainerWellKnownRoutesSlice } from "../container.js";
import type { Env } from "../env.js";

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, "");
}

export function createWellKnownRoutes(container: ContainerWellKnownRoutesSlice, env: Env) {
  const r = new Hono();
  const issuer = stripTrailingSlash(env.OIDC_ISSUER_URL ?? env.API_PUBLIC_URL);
  const authBase = `${issuer}/api/auth`;

  r.get("/openid-configuration", (c) => {
    c.header("Cache-Control", "public, max-age=60");
    return c.json({
      issuer,
      authorization_endpoint: `${authBase}/oauth2/authorize`,
      token_endpoint: `${authBase}/oauth2/token`,
      userinfo_endpoint: `${authBase}/oauth2/userinfo`,
      jwks_uri: `${issuer}/.well-known/jwks.json`,
      response_types_supported: ["code"],
      subject_types_supported: ["public"],
      id_token_signing_alg_values_supported: ["RS256"],
      scopes_supported: ["openid", "profile", "email", "offline_access"],
      token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
      claims_supported: ["sub", "email", "email_verified", "name", "image", "role"],
      code_challenge_methods_supported: ["S256"],
    });
  });

  r.get("/jwks.json", async (c) => {
    c.header("Cache-Control", "public, max-age=60");
    return c.json(await container.getPublicJwks());
  });

  return r;
}
