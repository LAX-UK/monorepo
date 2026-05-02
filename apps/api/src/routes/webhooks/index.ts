import { Hono } from "hono";
import type { Container } from "../../container.js";
import { createShopifyWebhookRoutes } from "./shopify.js";
import { createWordPressWebhookRoutes } from "./wordpress.js";

export function createWebhookRoutes(container: Container) {
  return new Hono()
    .route("/shopify", createShopifyWebhookRoutes(container))
    .route("/wordpress", createWordPressWebhookRoutes(container));
}
