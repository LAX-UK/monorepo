import { BACKCHANNEL_LOGOUT_EVENT } from "@auction/identity-contracts";
import type {
  BackchannelLogoutDelivery,
  BackchannelLogoutDeliveryRepository,
  BackchannelLogoutDispatcher,
  LogoutTokenSigner,
} from "./backchannel-logout.ports.js";

export const BACKCHANNEL_LOGOUT_MAX_ATTEMPTS = 8;
export const BACKCHANNEL_LOGOUT_TIMEOUT_MS = 5_000;
export const BACKCHANNEL_LOGOUT_CONCURRENCY = 4;

export function backchannelRetryDelayMs(attempt: number): number {
  return Math.min(15_000 * 2 ** Math.max(0, attempt - 1), 60 * 60 * 1_000);
}

export function nextBackchannelDeliveryAttempt(
  delivered: boolean,
  previousAttempts: number,
  now: Date,
) {
  const attemptCount = previousAttempts + 1;
  return {
    status: delivered
      ? ("delivered" as const)
      : attemptCount >= BACKCHANNEL_LOGOUT_MAX_ATTEMPTS
        ? ("failed" as const)
        : ("pending" as const),
    attemptCount,
    nextAttemptAt: new Date(now.getTime() + backchannelRetryDelayMs(attemptCount)),
  };
}

export class BackchannelLogoutDeliveryWorker {
  constructor(
    private readonly deliveries: BackchannelLogoutDeliveryRepository,
    private readonly issuer: string,
    private readonly signer: LogoutTokenSigner,
    private readonly dispatcher: BackchannelLogoutDispatcher,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async drain(batchSize = 40): Promise<number> {
    const now = this.now();
    const claimed = await this.deliveries.claimDue({
      now,
      staleBefore: new Date(now.getTime() - 60_000),
      batchSize,
    });
    for (let offset = 0; offset < claimed.length; offset += BACKCHANNEL_LOGOUT_CONCURRENCY) {
      await Promise.all(
        claimed
          .slice(offset, offset + BACKCHANNEL_LOGOUT_CONCURRENCY)
          .map((row) => this.deliver(row)),
      );
    }
    return claimed.length;
  }

  private async deliver(row: BackchannelLogoutDelivery): Promise<void> {
    let statusCode: number | null = null;
    let errorMessage: string | null = null;
    try {
      const logoutToken = await this.signer.signLogoutToken({
        iss: this.issuer.replace(/\/+$/, ""),
        aud: row.clientId,
        iat: row.tokenIat,
        jti: row.tokenJti,
        events: { [BACKCHANNEL_LOGOUT_EVENT]: {} },
        ...(row.sid ? { sid: row.sid } : { sub: row.subjectId }),
      });
      const response = await this.dispatcher.dispatch(
        row.endpoint,
        logoutToken,
        BACKCHANNEL_LOGOUT_TIMEOUT_MS,
      );
      statusCode = response.status;
      if (statusCode < 200 || statusCode >= 300) errorMessage = `receiver_http_${statusCode}`;
    } catch (error) {
      errorMessage = error instanceof Error ? error.message.slice(0, 500) : "delivery_failed";
    }
    const finalizedAt = this.now();
    const next = nextBackchannelDeliveryAttempt(
      errorMessage === null,
      row.attemptCount,
      finalizedAt,
    );
    await this.deliveries.finalize({
      id: row.id,
      ...next,
      deliveredAt: errorMessage === null ? finalizedAt : null,
      statusCode,
      errorMessage,
      finalizedAt,
    });
  }
}
