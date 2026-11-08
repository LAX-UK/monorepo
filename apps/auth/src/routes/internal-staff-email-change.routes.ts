import { createHash, timingSafeEqual } from "node:crypto";
import {
  STAFF_EMAIL_CHANGE_CANCEL_SUBROUTE,
  STAFF_EMAIL_CHANGE_SUBROUTE,
  staffEmailChangeCancelRequestSchema,
  staffEmailChangeRequestSchema,
} from "@auction/identity-contracts";
import type { Context, Hono } from "hono";
import type { StaffEmailChangeService } from "../services/staff-email-change.service.js";

/** The credential Bid admin uses to start a staff-assisted email change. It is not the lifecycle credential. */
export type StaffEmailChangeMachineDeps = {
  changes: Pick<StaffEmailChangeService, "start" | "cancel">;
  /** Tokens issued for the `staff_email_change` scope are stored and looked up under their own key. */
  redis: { get(key: string): Promise<string | null> };
  clientId: string;
  clientSecret: string;
  onFailure?: (error: unknown) => void;
};

/** Where a staff-email-change token lives; the other machine routes never look here, nor these there. */
export function staffEmailChangeTokenKey(token: string): string {
  return `identity:staff-email-change-token:${createHash("sha256").update(token).digest("hex")}`;
}

function safeEqual(left: string, right: string): boolean {
  return timingSafeEqual(
    createHash("sha256").update(left).digest(),
    createHash("sha256").update(right).digest(),
  );
}

const FAILURE_STATUS = {
  subject_not_found: 404,
  same_email: 409,
  email_taken: 409,
  channel_unavailable: 503,
  none_in_progress: 409,
} as const;

function failureStatus(result: { kind: keyof typeof FAILURE_STATUS }) {
  return FAILURE_STATUS[result.kind];
}

/**
 * The staff-assisted email change. Mounted before the lifecycle routes' own authentication, so it
 * accepts only a token issued for the `staff_email_change` scope: a lifecycle token is refused
 * here just as this one is refused there.
 */
export function mountStaffEmailChangeMachineRoutes(
  app: Hono,
  deps: StaffEmailChangeMachineDeps,
): void {
  async function hasToken(c: Context): Promise<boolean> {
    const authorization = c.req.header("authorization");
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
    const clientId = token ? await deps.redis.get(staffEmailChangeTokenKey(token)) : null;
    return clientId !== null && safeEqual(clientId, deps.clientId);
  }

  app.post(`/identity${STAFF_EMAIL_CHANGE_SUBROUTE}`, async (c) => {
    c.header("Cache-Control", "no-store");
    if (!(await hasToken(c))) return c.json({ error: "unauthorized" }, 401);
    const request = staffEmailChangeRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!request.success) return c.json({ error: "invalid_request" }, 400);
    try {
      const result = await deps.changes.start(c.req.param("subjectId"), request.data);
      return result.ok
        ? c.json({ pendingEmail: result.pendingEmail })
        : c.json({ error: result.kind }, failureStatus(result));
    } catch (error) {
      deps.onFailure?.(error);
      return c.json({ error: "temporarily_unavailable" }, 503);
    }
  });

  app.post(`/identity${STAFF_EMAIL_CHANGE_CANCEL_SUBROUTE}`, async (c) => {
    c.header("Cache-Control", "no-store");
    if (!(await hasToken(c))) return c.json({ error: "unauthorized" }, 401);
    const request = staffEmailChangeCancelRequestSchema.safeParse(
      await c.req.json().catch(() => null),
    );
    if (!request.success) return c.json({ error: "invalid_request" }, 400);
    try {
      const result = await deps.changes.cancel(c.req.param("subjectId"), request.data);
      return result.ok
        ? c.json({ cancelled: true })
        : c.json({ error: result.kind }, failureStatus(result));
    } catch (error) {
      deps.onFailure?.(error);
      return c.json({ error: "temporarily_unavailable" }, 503);
    }
  });
}
