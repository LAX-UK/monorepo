import {
  VISITOR_ALERT_CONFIRM_TTL_MS,
  VISITOR_ALERT_CONSENT_TEXT,
  evaluateConfirmation,
  normaliseAlertEmail,
  shouldSendConfirmation,
} from "@auction/domain";
import type { IEmailService } from "@auction/email";
import type { IVisitorSaleAlertRepository } from "@auction/persistence/interfaces";
import { createVisitorAlertToken, verifyVisitorAlertToken } from "../lib/visitor-alert-token.js";

export type VisitorAlertConfirmOutcome = "confirmed" | "expired" | "invalid";

/** What a signed-in client sees in settings about the visitor list for their own address. */
export type VisitorAlertSettingsState = "none" | "pending" | "on" | "linked";

export interface IVerifiedEmailOwner {
  /** The client's address and whether it is verified; null when the client does not exist. */
  findEmail(userId: string): Promise<{ email: string; verified: boolean } | null>;
}

export type VisitorSaleAlertDeps = {
  subscribers: IVisitorSaleAlertRepository;
  email: IEmailService;
  owners: IVerifiedEmailOwner;
  secret: string;
  /** Where people open the confirm and unsubscribe pages. */
  webOrigin: string;
  /** Where mail clients POST a one-click unsubscribe. */
  apiPublicUrl: string;
  now?: () => Date;
};

const trim = (url: string) => url.replace(/\/$/, "");

export class VisitorSaleAlertService {
  private readonly now: () => Date;

  constructor(private readonly deps: VisitorSaleAlertDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  /**
   * Starts a double opt-in request. It never says whether the address was already known: the
   * caller gets the same answer every time, and only the inbox owner learns anything.
   */
  async subscribe(input: { email: string; source: string }): Promise<void> {
    const email = normaliseAlertEmail(input.email);
    const now = this.now();
    const existing = await this.deps.subscribers.findByEmail(email);
    if (!shouldSendConfirmation(existing, now)) return;

    const record = await this.deps.subscribers.savePending({
      email,
      consentText: VISITOR_ALERT_CONSENT_TEXT,
      consentSource: input.source,
      now,
    });
    if (record.status !== "pending") return;

    const requestedAtMs = record.requestedAt.getTime();
    const confirm = createVisitorAlertToken(
      { kind: "confirm", subscriberId: record.id, requestedAtMs },
      this.deps.secret,
    );
    const unsubscribe = this.unsubscribeToken(record.id);
    await this.deps.email.enqueue({
      template: "visitor-alert-confirm",
      to: email,
      category: "transactional",
      idempotencyKey: `visitor-alert-confirm:${record.id}:${requestedAtMs}`,
      vars: {
        confirmUrl: `${trim(this.deps.webOrigin)}/alerts/confirm?t=${encodeURIComponent(confirm)}`,
        expirationHours: VISITOR_ALERT_CONFIRM_TTL_MS / 3_600_000,
        unsubscribeUrl: `${trim(this.deps.webOrigin)}/alerts/unsubscribe?t=${encodeURIComponent(unsubscribe)}`,
        listUnsubscribeUrl: `${trim(this.deps.apiPublicUrl)}/sale-alerts/unsubscribe?t=${encodeURIComponent(unsubscribe)}`,
      },
    });
  }

  async confirm(token: string): Promise<VisitorAlertConfirmOutcome> {
    const payload = verifyVisitorAlertToken(token, this.deps.secret, "confirm");
    if (!payload) return "invalid";
    const now = this.now();
    const row = await this.deps.subscribers.findById(payload.subscriberId);
    const result = evaluateConfirmation(row, payload.requestedAtMs, now);
    if (result === "confirmed" && row) await this.deps.subscribers.confirm(row.id, now);
    return result === "already_confirmed" ? "confirmed" : result;
  }

  /** The address an unsubscribe link belongs to, or null when the link is not genuine. */
  async unsubscribePreview(token: string): Promise<{ email: string } | null> {
    const row = await this.rowForUnsubscribe(token);
    return row ? { email: row.email } : null;
  }

  async unsubscribe(token: string): Promise<boolean> {
    const row = await this.rowForUnsubscribe(token);
    if (!row) return false;
    await this.deps.subscribers.unsubscribe(row.id, this.now());
    return true;
  }

  async settingsState(userId: string): Promise<VisitorAlertSettingsState> {
    const row = await this.rowForClient(userId);
    if (!row || row.status === "unsubscribed") return "none";
    if (row.status === "pending") return "pending";
    return row.linkedUserId === userId ? "linked" : "on";
  }

  /** Ties a confirmed visitor subscription to the signed-in client who owns the address. */
  async linkToClient(userId: string): Promise<boolean> {
    const row = await this.rowForClient(userId);
    if (!row || row.status !== "confirmed") return false;
    await this.deps.subscribers.linkUser(row.id, userId, this.now());
    return true;
  }

  async stopForClient(userId: string): Promise<void> {
    const row = await this.rowForClient(userId);
    if (row && row.status !== "unsubscribed") {
      await this.deps.subscribers.unsubscribe(row.id, this.now());
    }
  }

  private unsubscribeToken(subscriberId: string): string {
    return createVisitorAlertToken({ kind: "unsubscribe", subscriberId }, this.deps.secret);
  }

  private async rowForUnsubscribe(token: string) {
    const payload = verifyVisitorAlertToken(token, this.deps.secret, "unsubscribe");
    return payload ? this.deps.subscribers.findById(payload.subscriberId) : null;
  }

  /** The visitor row for a client's own address; only a verified address may manage it. */
  private async rowForClient(userId: string) {
    const owner = await this.deps.owners.findEmail(userId);
    if (!owner?.verified) return null;
    return this.deps.subscribers.findByEmail(normaliseAlertEmail(owner.email));
  }
}
