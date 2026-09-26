import type { Hono } from "hono";

type FedcmRoutesDeps = {
  issuerOrigin: string;
  enabled: boolean;
};

export function registerFedcmRoutes(app: Hono, deps: FedcmRoutesDeps): void {
  if (!deps.enabled) {
    return;
  }

  app.get("/fedcm/config.json", (c) => {
    return c.json({
      accounts_endpoint: `${deps.issuerOrigin}/fedcm/accounts`,
      client_metadata_endpoint: `${deps.issuerOrigin}/fedcm/client-metadata`,
      id_assertion_endpoint: `${deps.issuerOrigin}/fedcm/assertion`,
    });
  });

  app.get("/fedcm/client-metadata", (c) => {
    return c.json({
      privacy_policy_url: `${deps.issuerOrigin}/privacy`,
      terms_of_service_url: `${deps.issuerOrigin}/terms`,
    });
  });

  app.get("/fedcm/accounts", (c) => {
    if (c.req.header("sec-fetch-dest")?.toLowerCase() !== "webidentity") {
      return c.body(null, 403);
    }
    return c.json({ accounts: [] });
  });

  app.post("/fedcm/assertion", async (c) => {
    if (c.req.header("sec-fetch-dest")?.toLowerCase() !== "webidentity") {
      return c.body(null, 403);
    }
    return c.json({ error: "not_implemented" }, 501);
  });
}
