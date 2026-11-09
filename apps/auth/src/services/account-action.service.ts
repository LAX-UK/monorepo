import {
  ACCOUNT_ACTION_PATH,
  ACCOUNT_ACTION_TICKET_TTL_SECONDS,
  type AccountSignInMethodReturnError,
  REGISTERED_OIDC_CLIENT_IDS,
  type SignInMethodKind,
  type SocialSignInProvider,
} from "@auction/identity-contracts";
import type { AccountActionTicketStore } from "./account-action-ticket.js";
import type { SignInMethodsAvailability } from "./account-sign-in-methods.service.js";
import type { IdentityOperationsService } from "./identity-operations.service.js";
import { RecentSessionGuard } from "./recent-session-guard.js";

export type AccountActionPorts = {
  tickets: AccountActionTicketStore;
  operations: Pick<IdentityOperationsService, "listSessions" | "readSignInMethods">;
  /**
   * Whether the person is a staff account (a Google or Apple link is never made for staff). A
   * failed read throws, and the request fails closed.
   */
  readSubject(subjectId: string): Promise<{ isStaff: boolean }>;
  available: SignInMethodsAvailability;
  /** The issuer's public origin, where `/account-action` lives. */
  issuerOrigin: string;
};

/** Why the intent was refused; `reauth_required` is the 403 every sensitive Account call shares. */
export type StartActionResult =
  | { ok: true; url: string }
  | { ok: false; reason: "reauth_required" }
  | { ok: false; kind: "not_available" | "staff_not_allowed" | "already_linked" };

/** The browser that arrived at `/account-action`: the issuer session its cookie holds, if any. */
export type BrowserSession = { id: string; userId: string } | null;

export type RedeemActionResult =
  | { ok: true; action: SignInMethodKind; subjectId: string }
  | {
      ok: false;
      code: AccountSignInMethodReturnError | "already_done";
      provider?: SocialSignInProvider;
    };

function isProvider(action: SignInMethodKind): action is SocialSignInProvider {
  return action === "google" || action === "apple";
}

/**
 * The one hand-off for adding a way to sign in (SM1). LAX Account asks for a ticket; the browser
 * brings it to the issuer's own page, which checks it again and runs the provider round trip.
 * Account never holds a provider token or a browser session of the issuer's.
 *
 * Every step that can be checked is checked twice, once when the ticket is made and again when it
 * is spent, because the account can change in between: the sign-in must still be recent (SM2),
 * the browser must be in the very session the request was made from, the person must still be
 * allowed to use Google or Apple (SM14), and the method must still be on offer. The ticket is
 * spent before any of that, so a wrong browser or a stale sign-in uses it up rather than leaving
 * it to try again.
 */
export class AccountActionService {
  private readonly sessions: RecentSessionGuard;

  constructor(
    private readonly ports: AccountActionPorts,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.sessions = new RecentSessionGuard(ports.operations, now);
  }

  async start(
    subjectId: string,
    sessionId: string,
    action: SignInMethodKind,
  ): Promise<StartActionResult> {
    if (!(await this.sessions.findRecent(subjectId, sessionId))) {
      return { ok: false, reason: "reauth_required" };
    }
    const refusal = await this.refusalFor(subjectId, action);
    if (refusal) return { ok: false, kind: refusal };
    const secret = await this.ports.tickets.issue(
      {
        subjectId,
        sessionId,
        action,
        clientId: REGISTERED_OIDC_CLIENT_IDS.LAX_ACCOUNT_WEB,
        issuedAt: this.now().getTime(),
      },
      ACCOUNT_ACTION_TICKET_TTL_SECONDS,
    );
    const url = new URL(ACCOUNT_ACTION_PATH, `${this.ports.issuerOrigin}/`);
    url.searchParams.set("ticket", secret);
    return { ok: true, url: url.toString() };
  }

  async redeem(secret: string, browser: BrowserSession): Promise<RedeemActionResult> {
    const ticket = await this.ports.tickets.consume(secret);
    if (!ticket || ticket.clientId !== REGISTERED_OIDC_CLIENT_IDS.LAX_ACCOUNT_WEB) {
      return { ok: false, code: "expired" };
    }
    if (!browser || browser.id !== ticket.sessionId || browser.userId !== ticket.subjectId) {
      return { ok: false, code: "reauth_required" };
    }
    if (!(await this.sessions.findRecent(ticket.subjectId, ticket.sessionId))) {
      return { ok: false, code: "reauth_required" };
    }
    const refusal = await this.refusalFor(ticket.subjectId, ticket.action);
    if (refusal === "staff_not_allowed") return { ok: false, code: "staff_not_allowed" };
    if (refusal === "not_available") return { ok: false, code: "provider_unavailable" };
    // Linked between the request and now (a second tab): the person has what they asked for.
    if (refusal === "already_linked" && isProvider(ticket.action)) {
      return { ok: false, code: "already_done", provider: ticket.action };
    }
    return { ok: true, action: ticket.action, subjectId: ticket.subjectId };
  }

  /** Whether `provider` is linked to the person, read from the account itself, never from the URL. */
  async isLinked(subjectId: string, provider: SocialSignInProvider): Promise<boolean> {
    const methods = await this.ports.operations.readSignInMethods(subjectId);
    return methods.social.some((method) => method.provider === provider);
  }

  private async refusalFor(
    subjectId: string,
    action: SignInMethodKind,
  ): Promise<"not_available" | "staff_not_allowed" | "already_linked" | null> {
    if (!this.ports.available[action]) return "not_available";
    if (!isProvider(action)) return null;
    if ((await this.ports.readSubject(subjectId)).isStaff) return "staff_not_allowed";
    return (await this.isLinked(subjectId, action)) ? "already_linked" : null;
  }
}
