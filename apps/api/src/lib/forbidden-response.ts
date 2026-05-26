import type { RoleCapability, UserRole, UserStaffRole } from "@auction/types";
import type { Context } from "hono";
import { AuthzError, LotError } from "./errors.js";

export type MissingCapabilityActor = {
  role: UserRole | string;
  staffRole: UserStaffRole | string | null;
};

export type MissingCapabilityBody = {
  error: string;
  code: "missing_capability";
  required: RoleCapability[];
  actor: MissingCapabilityActor;
};

export type OriginBlockedBody = {
  error: string;
  code: "origin_blocked";
};

export function originBlockedBody(message = "Forbidden"): OriginBlockedBody {
  return { error: message, code: "origin_blocked" };
}

export function respondOriginBlocked(c: Context, message = "Forbidden") {
  return c.json(originBlockedBody(message), 403);
}

export function missingCapabilityBody(
  message: string,
  required: RoleCapability[],
  actor: MissingCapabilityActor,
): MissingCapabilityBody {
  return {
    error: message,
    code: "missing_capability",
    required,
    actor,
  };
}

export function respondMissingCapability(
  c: Context,
  input: { message: string; required: RoleCapability[]; actor: MissingCapabilityActor },
) {
  return c.json(missingCapabilityBody(input.message, input.required, input.actor), 403);
}

/** Serialize {@link AuthzError} including structured missing-capability metadata when present. */
export function authzErrorJsonBody(e: AuthzError): Record<string, unknown> {
  if (e.code === "missing_capability" && e.required && e.actor) {
    return missingCapabilityBody(e.message, e.required, e.actor);
  }
  return { error: e.message };
}

export function respondAuthzError(c: Context, e: AuthzError) {
  return c.json(authzErrorJsonBody(e), e.status as 403);
}

/** Map service-layer errors to JSON bodies (AuthzError includes structured capability metadata). */
export function serviceErrorJsonBody(error: Error): Record<string, unknown> {
  if (error instanceof AuthzError) return authzErrorJsonBody(error);
  if (error instanceof LotError && error.code) {
    return { error: error.message, code: error.code };
  }
  return { error: error.message };
}
