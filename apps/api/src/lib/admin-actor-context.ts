import type { StaffRoles } from "@auction/types";
import type { ActorContext } from "../services/interfaces/queue-inspector.js";

type ActorSource = {
  get(key: "userId"): string | null | undefined;
  get(key: "userStaffRoles"): StaffRoles | undefined;
  req: { header: (name: string) => string | undefined };
};

/** Who is acting on a request, for audit trails and per-person rate limits. */
export function actorFromContext(c: ActorSource): ActorContext {
  const requestId = c.req.header("x-request-id");
  return {
    userId: c.get("userId") as string,
    staffRoles: c.get("userStaffRoles"),
    ...(requestId !== undefined ? { requestId } : {}),
  };
}
