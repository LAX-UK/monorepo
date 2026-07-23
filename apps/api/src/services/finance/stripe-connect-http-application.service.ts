import {
  isPlatformProfileStripeMessage,
  stripeConnectErrorToHttp,
} from "../../lib/stripe-connect-http-error.js";
import { recordMoneyPathEvent } from "../../middleware/metrics.js";
import type { FinanceHttpJson } from "../interfaces/finance-routes/finance-route-http.js";
import type {
  IStripeConnectHttpApplicationService,
  StripeConnectLegalEntityContext,
} from "../interfaces/finance-routes/finance-stripe-connect-http.js";
import { StripeConnectNotConfiguredError } from "../interfaces/stripe-connect.js";
import type { IStripeConnectService } from "../interfaces/stripe-connect.js";
import { ConnectServiceError } from "../stripe/connect/connect-service-errors.js";

type RouteErrorOptions = {
  recordAccountCreateFailure?: boolean;
};

function hasFinanceRole(
  ctx: StripeConnectLegalEntityContext,
  roles: Array<StripeConnectLegalEntityContext["role"]>,
): boolean {
  return roles.includes(ctx.role);
}

function mapConnectError(err: unknown, opts?: RouteErrorOptions): FinanceHttpJson | null {
  if (err instanceof StripeConnectNotConfiguredError) {
    return { status: 503, body: { error: "stripe_not_configured" } };
  }

  if (err instanceof ConnectServiceError) {
    return { status: err.httpStatus, body: { error: err.code } };
  }

  if (err instanceof Error) {
    const msg = err.message;
    if (isPlatformProfileStripeMessage(msg)) {
      if (opts?.recordAccountCreateFailure) {
        recordMoneyPathEvent("stripe_connect_account_create_failed");
      }
      return { status: 503, body: { error: "stripe_platform_profile_incomplete" } };
    }
    if (msg === "legal_entity_not_found") return { status: 404, body: { error: msg } };
    if (msg === "insufficient_role" || msg === "kyc_not_approved") {
      return { status: 403, body: { error: msg } };
    }
    if (msg === "stripe_account_missing") return { status: 400, body: { error: msg } };
    if (msg === "account_session_missing_client_secret") {
      return { status: 502, body: { error: msg } };
    }
    if (msg === "legal_entity_update_failed") return { status: 500, body: { error: msg } };
    if (msg.startsWith("connect_url_")) return { status: 400, body: { error: msg } };
  }

  const stripeMapped = stripeConnectErrorToHttp(err);
  if (!stripeMapped) return null;

  if (stripeMapped.recordAccountCreateFailure && opts?.recordAccountCreateFailure) {
    recordMoneyPathEvent("stripe_connect_account_create_failed");
  }

  return { status: stripeMapped.status, body: stripeMapped.body };
}

export class StripeConnectHttpApplicationService implements IStripeConnectHttpApplicationService {
  constructor(private readonly stripeConnectService: IStripeConnectService) {}

  async getClientConfig(): Promise<FinanceHttpJson> {
    try {
      return { status: 200, body: { data: this.stripeConnectService.getClientConfig() } };
    } catch (err) {
      if (err instanceof StripeConnectNotConfiguredError) {
        return { status: 200, body: { data: { publishableKey: null, connectEnforced: false } } };
      }
      throw err;
    }
  }

  async getStatus(ctx: StripeConnectLegalEntityContext): Promise<FinanceHttpJson> {
    try {
      const status = await this.stripeConnectService.getStatus(ctx.legalEntityId);
      return { status: 200, body: { data: status } };
    } catch (err) {
      const mapped = mapConnectError(err);
      if (mapped) return mapped;
      throw err;
    }
  }

  async syncAccountFromStripe(ctx: StripeConnectLegalEntityContext): Promise<FinanceHttpJson> {
    if (!hasFinanceRole(ctx, ["owner", "admin", "finance"])) {
      return { status: 403, body: { error: "insufficient_role" } };
    }
    try {
      const status = await this.stripeConnectService.syncAccountFromStripe(ctx.legalEntityId);
      return { status: 200, body: { data: status } };
    } catch (err) {
      const mapped = mapConnectError(err);
      if (mapped) return mapped;
      throw err;
    }
  }

  async createAccountSession(
    ctx: StripeConnectLegalEntityContext,
    surface: "onboarding" | "management",
  ): Promise<FinanceHttpJson> {
    try {
      const session = await this.stripeConnectService.createAccountSession(
        ctx.legalEntityId,
        ctx.role,
        surface,
      );
      return { status: 200, body: { data: session } };
    } catch (err) {
      const mapped = mapConnectError(err);
      if (mapped) return mapped;
      throw err;
    }
  }

  async ensureAccount(ctx: StripeConnectLegalEntityContext): Promise<FinanceHttpJson> {
    if (!hasFinanceRole(ctx, ["owner", "admin"])) {
      return { status: 403, body: { error: "insufficient_role" } };
    }
    try {
      const result = await this.stripeConnectService.ensureAccount(ctx.legalEntityId);
      return { status: 201, body: { data: result } };
    } catch (err) {
      const mapped = mapConnectError(err, { recordAccountCreateFailure: true });
      if (mapped) return mapped;
      throw err;
    }
  }

  async createOnboardingLink(
    ctx: StripeConnectLegalEntityContext,
    returnUrl: string,
    refreshUrl: string,
  ): Promise<FinanceHttpJson> {
    if (!hasFinanceRole(ctx, ["owner", "admin"])) {
      return { status: 403, body: { error: "insufficient_role" } };
    }
    try {
      const link = await this.stripeConnectService.createOnboardingLink(
        ctx.legalEntityId,
        returnUrl,
        refreshUrl,
      );
      return { status: 200, body: { data: link } };
    } catch (err) {
      const mapped = mapConnectError(err);
      if (mapped) return mapped;
      throw err;
    }
  }

  async createDashboardLink(ctx: StripeConnectLegalEntityContext): Promise<FinanceHttpJson> {
    if (!hasFinanceRole(ctx, ["owner", "admin", "finance"])) {
      return { status: 403, body: { error: "insufficient_role" } };
    }
    try {
      const link = await this.stripeConnectService.createDashboardLink(ctx.legalEntityId);
      return { status: 200, body: { data: link } };
    } catch (err) {
      const mapped = mapConnectError(err);
      if (mapped) return mapped;
      throw err;
    }
  }
}
