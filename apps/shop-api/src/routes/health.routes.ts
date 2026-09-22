import type { FastifyInstance } from "fastify";

export type HealthDeps = {
  checkConnectivity(): Promise<void>;
  checkCatalogueSchema(): Promise<void>;
};

type ReadyPayload =
  | { service: "shop-api"; status: "ok"; database: "ok"; catalogueSchema: "ok" }
  | {
      service: "shop-api";
      status: "degraded";
      database?: "unavailable";
      catalogueSchema?: "missing";
    };

export async function registerHealthRoutes(app: FastifyInstance, health: HealthDeps) {
  app.get("/health/live", async () => ({ service: "shop-api", status: "ok" }));

  app.get("/health/ready", async (_request, reply) => {
    try {
      await health.checkConnectivity();
    } catch {
      const body: ReadyPayload = {
        service: "shop-api",
        status: "degraded",
        database: "unavailable",
      };
      return reply.status(503).send(body);
    }

    try {
      await health.checkCatalogueSchema();
    } catch {
      const body: ReadyPayload = {
        service: "shop-api",
        status: "degraded",
        catalogueSchema: "missing",
      };
      return reply.status(503).send(body);
    }

    return {
      service: "shop-api",
      status: "ok",
      database: "ok",
      catalogueSchema: "ok",
    } satisfies ReadyPayload;
  });
}
