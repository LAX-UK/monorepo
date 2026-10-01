import type { FastifyInstance } from "fastify";

export type HealthDeps = {
  checkConnectivity(): Promise<void>;
  checkCatalogueSchema(): Promise<void>;
};

type ReadyPayload =
  | {
      service: "shop-api";
      status: "ok";
      database: "ok";
      catalogueSchema: "ok";
      release: string;
    }
  | {
      service: "shop-api";
      status: "degraded";
      database?: "unavailable";
      catalogueSchema?: "missing";
      release: string;
    };

export async function registerHealthRoutes(app: FastifyInstance, health: HealthDeps) {
  const release = process.env.SENTRY_RELEASE ?? "unknown";

  app.get("/health/live", async () => ({ service: "shop-api", status: "ok", release }));

  app.get("/health/ready", async (request, reply) => {
    try {
      await health.checkConnectivity();
    } catch (error) {
      request.log.warn({ err: error }, "shop_api_readiness_database_unavailable");
      const body: ReadyPayload = {
        service: "shop-api",
        status: "degraded",
        database: "unavailable",
        release,
      };
      return reply.status(503).send(body);
    }

    try {
      await health.checkCatalogueSchema();
    } catch (error) {
      request.log.warn({ err: error }, "shop_api_readiness_catalogue_schema_missing");
      const body: ReadyPayload = {
        service: "shop-api",
        status: "degraded",
        catalogueSchema: "missing",
        release,
      };
      return reply.status(503).send(body);
    }

    return {
      service: "shop-api",
      status: "ok",
      database: "ok",
      catalogueSchema: "ok",
      release,
    } satisfies ReadyPayload;
  });
}
