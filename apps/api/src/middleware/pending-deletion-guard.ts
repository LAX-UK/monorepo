import { accountDeletionPendingBody } from "@auction/identity-contracts";
import type { Hono, MiddlewareHandler } from "hono";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import type { IPendingDeletionReader } from "../services/interfaces/pending-deletion-reader.js";

type GuardedRoute = {
  method: "POST" | "PUT";
  /** Path as the app serves it, with `:id` for a parameter. */
  path: string;
};

/**
 * Every Bid route through which a person takes on something new: a bid, a registration to bid,
 * a telephone bid booking, consigning a lot, checkout, and starting a payout account. While a deletion request stands, each answers 403
 * with the same message, so the person is stopped wherever they try and told what to do.
 *
 * Adding a route here is the only change needed to put it behind the rule.
 */
export const PENDING_DELETION_GUARDED_ROUTES: readonly GuardedRoute[] = [
  { method: "POST", path: "/bids" },
  { method: "POST", path: "/lots/:id/absentee-bids" },
  { method: "PUT", path: "/lots/:id/auto-bid" },
  { method: "POST", path: "/sales/:id/register" },
  { method: "POST", path: "/sales/:id/telephone-bookings" },
  { method: "POST", path: "/telephone-bookings/:id/limit-increase" },
  { method: "POST", path: "/submissions/:id/submit" },
  { method: "POST", path: "/submissions/:id/agreement/accept" },
  { method: "POST", path: "/payments" },
  { method: "POST", path: "/stripe-connect/account" },
  { method: "POST", path: "/stripe-connect/onboarding-link" },
];

/**
 * Refuses the request when the signed-in person has asked to delete their account. A request
 * with no session passes through, so the route's own authentication still answers 401.
 */
export function createPendingDeletionGuard(deps: {
  authenticator: Pick<IAuthenticator, "getSessionUser">;
  reader: IPendingDeletionReader;
}): MiddlewareHandler {
  return async (c, next) => {
    const user = await deps.authenticator.getSessionUser(c.req.raw.headers);
    if (user) {
      const requestedAt = await deps.reader.requestedAt(user.id);
      if (requestedAt) return c.json(accountDeletionPendingBody(requestedAt), 403);
    }
    await next();
  };
}

/** Puts the guard in front of every route in {@link PENDING_DELETION_GUARDED_ROUTES}. */
export function mountPendingDeletionGuard(app: Hono, guard: MiddlewareHandler): void {
  for (const route of PENDING_DELETION_GUARDED_ROUTES) {
    app.on(route.method, route.path, guard);
  }
}
