import type { SsfReplayStore } from "@auction/identity-contracts";
import type { Hono } from "hono";
import { createShopSsfEventsRoute } from "../ssf.js";

export type ShopIdentitySsfDeps = {
  replayStore: SsfReplayStore;
  issuer: string;
  jwksUrl: string;
};

export function registerSsfRoutes(app: Hono, deps: ShopIdentitySsfDeps): void {
  app.route(
    "/api/ssf/events",
    createShopSsfEventsRoute({
      replayStore: deps.replayStore,
      issuer: deps.issuer,
      jwksUrl: deps.jwksUrl,
    }),
  );
}
