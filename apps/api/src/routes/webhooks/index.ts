import { Hono } from "hono";
import type { Container } from "../../container.js";
import { createPostmarkWebhookRoutes } from "./postmark.js";
import { createShopifyWebhookRoutes } from "./shopify.js";
import { createWordPressWebhookRoutes } from "./wordpress.js";

export function createWebhookRoutes(container: Container) {
  return new Hono()
    .route("/postmark", createPostmarkWebhookRoutes(container))
    .route("/shopify", createShopifyWebhookRoutes(container))
    .route("/wordpress", createWordPressWebhookRoutes(container));
}
