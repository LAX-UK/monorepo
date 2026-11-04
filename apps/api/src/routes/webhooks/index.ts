import { Hono } from "hono";
import type { ContainerInboundWebhookRoutesSlice } from "../../container.js";
import { createPostmarkWebhookRoutes } from "./postmark.js";
import { createZohoWebhookRoutes } from "./zoho.js";

export function createWebhookRoutes(container: ContainerInboundWebhookRoutesSlice) {
  return new Hono()
    .route("/postmark", createPostmarkWebhookRoutes(container))
    .route("/zoho", createZohoWebhookRoutes(container));
}
