import type { FastifyInstance } from "fastify";
import type { HealthDeps } from "../../health.routes.js";
import { registerHealthRoutes } from "../../health.routes.js";

export async function registerAdminHealthRoutes(app: FastifyInstance, health: HealthDeps) {
  await registerHealthRoutes(app, health);
}
