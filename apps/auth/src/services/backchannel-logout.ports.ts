import type { BACKCHANNEL_LOGOUT_EVENT } from "@auction/identity-contracts";

export type BackchannelLogoutClaims = {
  iss: string;
  aud: string;
  iat: number;
  jti: string;
  events: { [BACKCHANNEL_LOGOUT_EVENT]: Record<string, never> };
  sid?: string;
  sub?: string;
};

export type BackchannelLogoutDelivery = {
  id: string;
  clientId: string;
  subjectId: string;
  sid: string | null;
  endpoint: string;
  tokenJti: string;
  tokenIat: number;
  attemptCount: number;
};

export type BackchannelLogoutFinalization = {
  id: string;
  status: "delivered" | "pending" | "failed";
  attemptCount: number;
  nextAttemptAt: Date;
  deliveredAt: Date | null;
  statusCode: number | null;
  errorMessage: string | null;
  finalizedAt: Date;
};

/** One call is one transaction: RP revocation and outbox append are atomic. */
export type RpLogoutRepository = {
  revokeIdentitySessionsAndEnqueue(
    identitySessionIds: readonly string[],
    now: Date,
  ): Promise<number>;
  revokeSubjectAndEnqueue(subjectId: string, now: Date): Promise<number>;
  revokeClientSubjectAndEnqueue(clientId: string, subjectId: string, now: Date): Promise<number>;
};

export type BackchannelLogoutDeliveryRepository = {
  claimDue(input: {
    now: Date;
    staleBefore: Date;
    batchSize: number;
  }): Promise<BackchannelLogoutDelivery[]>;
  finalize(input: BackchannelLogoutFinalization): Promise<void>;
};

export type LogoutTokenSigner = {
  signLogoutToken(claims: BackchannelLogoutClaims): Promise<string>;
};

export type BackchannelLogoutDispatcher = {
  dispatch(endpoint: string, logoutToken: string, timeoutMs: number): Promise<{ status: number }>;
};
