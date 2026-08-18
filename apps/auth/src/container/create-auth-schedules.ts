import { startJwksRetirementSchedule } from "@auction/auth";
import type { Database } from "@auction/db";
import { Sentry } from "@auction/observability";
import type pino from "pino";
import type { BackchannelLogoutDeliveryWorker } from "../services/backchannel-logout-delivery.worker.js";
import { startBackchannelLogoutSchedule } from "../services/backchannel-logout.schedule.js";
import type { IdentityOperationsService } from "../services/identity-operations.service.js";
import { startIdentityRetentionSchedule } from "../services/identity-retention.schedule.js";
import type { SsfDeliveryWorker } from "../services/ssf-delivery.worker.js";
import type { SsfStreamService } from "../services/ssf-stream.service.js";

export function createAuthSchedules(options: {
  db: Database;
  log: pino.Logger;
  identityOperations: Pick<IdentityOperationsService, "purgeExpiredVerifications">;
  logoutDelivery: Pick<BackchannelLogoutDeliveryWorker, "drain">;
  ssfStreams: Pick<SsfStreamService, "provisionRegisteredStreams">;
  ssfDelivery: Pick<SsfDeliveryWorker, "enqueueFromDomainEvents" | "deliverDue">;
  ssfEnabled: boolean;
  ssfTimeoutMs: number;
  ssfMaxAttempts: number;
  onSsfOutcome: (outcome: "delivered" | "retry_scheduled" | "failed", id: string) => void;
}) {
  const provisioning = options.ssfStreams.provisionRegisteredStreams(options.ssfEnabled);
  void provisioning.catch((err) => {
    options.log.error({ err }, "ssf_stream_provisioning_failed");
    Sentry.captureException(err);
  });
  const verification = setInterval(
    () => {
      void options.identityOperations.purgeExpiredVerifications().catch((err) => {
        options.log.error({ err }, "expired verification cleanup failed");
        Sentry.captureException(err);
      });
    },
    60 * 60 * 1_000,
  );
  verification.unref();
  const logout = startBackchannelLogoutSchedule({
    service: options.logoutDelivery,
    onError: (err) => {
      options.log.error({ err }, "back-channel logout delivery drain failed");
      Sentry.captureException(err);
    },
  });
  const retention = startIdentityRetentionSchedule({
    db: options.db,
    onError: (err) => {
      options.log.error({ err }, "identity_retention_purge_failed");
      Sentry.captureException(err);
    },
  });
  let ssfDrain: Promise<void> | null = null;
  const ssf = options.ssfEnabled
    ? setInterval(() => {
        if (ssfDrain) return;
        ssfDrain = provisioning
          .then(async () => {
            await options.ssfDelivery.enqueueFromDomainEvents();
            const count = await options.ssfDelivery.deliverDue({
              timeoutMs: options.ssfTimeoutMs,
              maxAttempts: options.ssfMaxAttempts,
              onOutcome: options.onSsfOutcome,
            });
            if (count > 0) options.log.info({ count }, "ssf_delivery_batch");
          })
          .catch((err) => {
            options.log.error({ err }, "ssf_delivery_drain_failed");
            Sentry.captureException(err);
          })
          .finally(() => {
            ssfDrain = null;
          });
      }, 1_000)
    : null;
  ssf?.unref();
  const retirement = startJwksRetirementSchedule({ db: options.db, log: options.log });

  return {
    stop: async () => {
      retirement.stop();
      clearInterval(verification);
      if (ssf) clearInterval(ssf);
      await Promise.allSettled([logout.stop(), retention.stop(), ssfDrain ?? Promise.resolve()]);
    },
  };
}
