import type { SessionUser } from "@/lib/data/contracts";
import {
  normalizeUserRoleOrClient,
  roleHasCapability,
  staffRoleDefaultDestination,
} from "@auction/types";

type Person = Pick<SessionUser, "role" | "staffRole">;

/**
 * Whether the person uses Bid as a client. Staff accounts never do: the API refuses them bids,
 * registrations, checkout and submissions, so the client area would only lead to dead ends.
 */
export function usesBidAsClient(user: Person): boolean {
  return roleHasCapability(normalizeUserRoleOrClient(user.role), "bid.place", user.staffRole);
}

/**
 * Where someone who does not use Bid as a client goes instead of a client-area page (their admin
 * area), or `null` when they may stay.
 */
export function clientAreaRedirectFor(user: Person, requestedPath: string): string | null {
  if (usesBidAsClient(user)) return null;
  const destination = staffRoleDefaultDestination(
    normalizeUserRoleOrClient(user.role),
    user.staffRole ?? null,
  );
  const pathOf = (href: string) => href.split(/[?#]/)[0] ?? href;
  return pathOf(destination) === pathOf(requestedPath) ? null : destination;
}
