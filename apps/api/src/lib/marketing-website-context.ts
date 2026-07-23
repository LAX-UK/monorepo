import type { WebsiteEventContext } from "./marketing-event-factory.js";

export function marketingWebsiteContextFromHono(c: {
  get: WebsiteEventContext["get"];
  req: WebsiteEventContext["req"];
}): WebsiteEventContext {
  return { get: c.get.bind(c), req: c.req };
}
