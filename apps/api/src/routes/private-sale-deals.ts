import { privateSaleRefParamSchema } from "@auction/validators";
import { Hono } from "hono";
import type { ContainerPrivateSaleDealRoutesSlice } from "../container.js";
import { zValidator } from "../lib/z-validator.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import type {
  AcceptTermsError,
  PayDealError,
} from "../services/interfaces/private-sale-deal-desk.js";

const ACCEPT_ERROR_STATUS = {
  deal_not_found: 404,
  terms_not_configured: 409,
  not_open_for_terms: 409,
  unavailable: 503,
} as const satisfies Record<AcceptTermsError, 404 | 409 | 503>;

const PAY_ERROR_STATUS = {
  deal_not_found: 404,
  not_payable: 409,
  compliance_hold: 409,
  not_payable_online: 409,
  already_paid: 409,
  in_progress: 409,
  unavailable: 503,
} as const satisfies Record<PayDealError, 404 | 409 | 503>;

/**
 * A buyer's and a seller's own private sale deals: the list, one deal, accepting the terms and
 * paying. A deal exists for a person only if they are named to act in it, so a reference that
 * is not theirs answers exactly as one that does not exist.
 */
export function createPrivateSaleDealRoutes(
  container: ContainerPrivateSaleDealRoutesSlice,
  authenticator: IAuthenticator,
) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const r = new Hono<{ Variables: { userId?: string } }>();
  r.use("*", requireAuth);

  /** GET /private-sales — the deals the signed-in person is named in. */
  r.get("/", async (c) => {
    const data = await container.finance.privateSaleDealParties.list(c.get("userId") as string);
    return c.json({ data });
  });

  /** GET /private-sales/:ref — one deal, as the person's side may see it. */
  r.get("/:ref", zValidator("param", privateSaleRefParamSchema), async (c) => {
    const data = await container.finance.privateSaleDealParties.detail(
      c.get("userId") as string,
      c.req.valid("param").ref,
    );
    if (!data) return c.json({ error: "deal_not_found" }, 404);
    return c.json({ data });
  });

  /** POST /private-sales/:ref/accept-terms — accept the current private sale terms. */
  r.post("/:ref/accept-terms", zValidator("param", privateSaleRefParamSchema), async (c) => {
    const result = await container.finance.privateSaleDealParties.acceptTerms(
      c.get("userId") as string,
      c.req.valid("param").ref,
    );
    if (result.ok) return c.json({ data: result.detail });
    return c.json({ error: result.error }, ACCEPT_ERROR_STATUS[result.error]);
  });

  /** POST /private-sales/:ref/payment — open the checkout that pays the invoice. */
  r.post("/:ref/payment", zValidator("param", privateSaleRefParamSchema), async (c) => {
    const result = await container.finance.privateSaleDealParties.pay(
      c.get("userId") as string,
      c.req.valid("param").ref,
    );
    if (result.ok) {
      return c.json({ data: { checkoutUrl: result.checkoutUrl, amountMinor: result.amountMinor } });
    }
    return c.json({ error: result.error }, PAY_ERROR_STATUS[result.error]);
  });

  return r;
}
