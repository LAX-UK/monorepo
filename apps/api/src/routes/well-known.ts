import { buildOidcDiscoveryDocument, normalizeAuthIssuerUrl } from "@auction/auth/server";
import { Hono } from "hono";
import type { ContainerWellKnownRoutesSlice } from "../container.js";
import type { Env } from "../env.js";

export function createWellKnownRoutes(container: ContainerWellKnownRoutesSlice, env: Env) {
  const r = new Hono();
  const issuer = normalizeAuthIssuerUrl(env.OIDC_ISSUER_URL ?? env.API_PUBLIC_URL);

  r.get("/openid-configuration", (c) => {
    c.header("Cache-Control", "public, max-age=60");
    return c.json(buildOidcDiscoveryDocument(issuer));
  });

  r.get("/jwks.json", async (c) => {
    c.header("Cache-Control", "public, max-age=60");
    return c.json(await container.getPublicJwks());
  });

  return r;
}
