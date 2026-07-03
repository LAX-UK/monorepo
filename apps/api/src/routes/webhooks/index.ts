import { Hono } from "hono";
import type { ContainerInboundWebhookRoutesSlice } from "../../container.js";
import { createBrevoWebhookRoutes } from "./brevo.js";
import { createPostmarkWebhookRoutes } from "./postmark.js";
import { createShopifyWebhookRoutes } from "./shopify.js";
import { createWordPressWebhookRoutes } from "./wordpress.js";

export function createWebhookRoutes(container: ContainerInboundWebhookRoutesSlice) {
  return new Hono()
    .route("/postmark", createPostmarkWebhookRoutes(container))
    .route("/brevo", createBrevoWebhookRoutes(container))
    .route("/shopify", createShopifyWebhookRoutes(container))
    .route("/wordpress", createWordPressWebhookRoutes(container));
}
