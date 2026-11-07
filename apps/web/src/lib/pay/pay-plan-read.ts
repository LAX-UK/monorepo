import type { PayPlan } from "@auction/types";
import { lookupErrorCode } from "./pay-codes";
import { parsePayPlan } from "./pay-plan.schema";

/** Why the API will not plan a payment for this reader, as the page tells it. */
export type PayRefusal =
  /** The account is suspended. */
  | "suspended"
  /** A staff account: staff never pay. */
  | "staff"
  /** The reader's role in this account does not pay or follow its purchases. */
  | "no_role"
  /** The lots asked for are not a valid pick (none, too many, or one twice). */
  | "bad_pick";

/** The answer to asking for a plan. A plan that could not be read is never a plan to pay. */
export type PayPlanRead =
  | { kind: "ok"; plan: PayPlan }
  | { kind: "refused"; reason: PayRefusal }
  | { kind: "unavailable" };

const REFUSAL_BY_CODE: Readonly<Record<string, PayRefusal>> = {
  account_suspended: "suspended",
  bidding_not_allowed_for_role: "staff",
  insufficient_entity_role: "no_role",
  pay_several_empty: "bad_pick",
  pay_several_too_many: "bad_pick",
  pay_several_duplicate: "bad_pick",
};

/** Reads the API's answer to the pay-plan request: a plan, a refusal the reader can be told, or a failure. */
export function readPayPlanResponse(status: number, body: unknown): PayPlanRead {
  if (status >= 200 && status < 300) {
    const data =
      body && typeof body === "object" && "data" in body ? (body as { data: unknown }).data : null;
    const plan = parsePayPlan(data);
    return plan ? { kind: "ok", plan } : { kind: "unavailable" };
  }
  const reason = lookupErrorCode(body, REFUSAL_BY_CODE);
  return reason ? { kind: "refused", reason } : { kind: "unavailable" };
}
