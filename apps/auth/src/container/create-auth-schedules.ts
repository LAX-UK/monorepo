import { type IdentityDatabase, startJwksRetirementSchedule } from "@auction/identity-db";
import { Sentry } from "@auction/observability";
import type pino from "pino";
import { startIdentityDeletionPurgeSchedule } from "../infrastructure/identity-deletion-purge.schedule.js";
import { startIdentityLifecycleReconciliationSchedule } from "../infrastructure/identity-lifecycle-reconciliation.schedule.js";
import { startIdentityRetentionSchedule } from "../infrastructure/identity-retention.schedule.js";
import { startSubjectExportMaintenanceSchedule } from "../infrastructure/subject-export-maintenance.schedule.js";
import type { BackchannelLogoutDeliveryWorker } from "../services/backchannel-logout-delivery.worker.js";
import { startBackchannelLogoutSchedule } from "../services/backchannel-logout.schedule.js";
import type { DurableSecurityEffects } from "../services/durable-security-effects.js";
import type { IdentityDeletionPurgeService } from "../services/identity-deletion-purge.service.js";
import type { SsfDeliveryWorker } from "../services/ssf-delivery.worker.js";
import type { SsfStreamService } from "../services/ssf-stream.service.js";
import type { SubjectExportService } from "../services/subject-export.service.js";

export async function createAuthSchedules(options: {
  db: IdentityDatabase;
  log: pino.Logger;
  identityOperations: {
    purgeExpiredVerifications(): Promise<number>;
    purgeExpiredEmailChanges(): Promise<number>;
  };
  logoutDelivery: Pick<BackchannelLogoutDeliveryWorker, "drain">;
  securityEffects: Pick<DurableSecurityEffects, "drain" | "settle">;
  deletionPurge: Pick<IdentityDeletionPurgeService, "run">;
  ssfStreams: Pick<SsfStreamService, "provisionRegisteredStreams">;
  ssfDelivery: Pick<SsfDeliveryWorker, "enqueueFromDomainEvents" | "deliverDue">;
  subjectExports: Pick<SubjectExportService, "expireDue" | "claimDeadlineAlerts">;
  /** The logger the overdue alerts go through, wrapped so they also reach Sentry. */
  alertLog: Pick<pino.Logger, "warn" | "error">;
  ssfEnabled: boolean;
  ssfTimeoutMs: number;
  ssfMaxAttempts: number;
  onSsfOutcome: (outcome: "delivered" | "retry_scheduled" | "failed", id: string) => void;
  reconcileAuthAtRest?: () => Promise<void>;
}) {
  let provisioning: Promise<void>;
  try {
    await options.ssfStreams.provisionRegisteredStreams(options.ssfEnabled);
    provisioning = Promise.resolve();
  } catch (err) {
    options.log.error({ err }, "ssf_stream_provisioning_failed");
    Sentry.captureException(err);
    throw err;
  }
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
  // Expired email changes are already ignored when read or claimed; this only stops rows lingering.
  const emailChanges = setInterval(
    () => {
      void options.identityOperations.purgeExpiredEmailChanges().catch((err) => {
        options.log.error({ err }, "expired email change cleanup failed");
        Sentry.captureException(err);
      });
    },
    24 * 60 * 60 * 1_000,
  );
  emailChanges.unref();
  const logout = startBackchannelLogoutSchedule({
    service: options.logoutDelivery,
    onError: (err) => {
      options.log.error({ err }, "back-channel logout delivery drain failed");
      Sentry.captureException(err);
    },
  });
  // Polls at the shortest retry delay so a failed revocation is retried on time.
  const securityEffects = startBackchannelLogoutSchedule({
    service: options.securityEffects,
    intervalMs: 2_000,
    onError: (err) => {
      options.log.error({ err }, "auth_security_effect_drain_failed");
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
  const deletionPurge = startIdentityDeletionPurgeSchedule({
    service: options.deletionPurge,
    onError: (err) => {
      options.log.error({ err }, "identity_deletion_purge_failed");
      Sentry.captureException(err);
    },
    onRun: (summary) =>
      options.log.info(
        {
          purged: summary.purged.length,
          held: summary.held,
          deferred: summary.deferred,
          reminded: summary.reminded,
        },
        "identity_deletion_purge_run",
      ),
  });
  const lifecycleReconciliation = startIdentityLifecycleReconciliationSchedule({
    db: options.db,
    onError: (err) => {
      options.log.error({ err }, "identity_lifecycle_reconciliation_failed");
      Sentry.captureException(err);
    },
    onReconciled: (counts) => options.log.warn(counts, "identity_lifecycle_outbox_reconciled"),
  });
  const subjectExportMaintenance = startSubjectExportMaintenanceSchedule({
    service: options.subjectExports,
    log: options.alertLog,
    onError: (err) => {
      options.log.error({ err }, "subject_export_maintenance_failed");
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
  const retirement = startJwksRetirementSchedule({
    db: options.db,
    log: options.log,
  });
  const reconcileAuthAtRest = () => {
    void options.reconcileAuthAtRest?.().catch((err) => {
      options.log.error({ err }, "auth_at_rest_reconciliation_failed");
      Sentry.captureException(err);
    });
  };
  if (options.reconcileAuthAtRest) reconcileAuthAtRest();
  const atRestReconciliation = options.reconcileAuthAtRest
    ? setInterval(reconcileAuthAtRest, 5 * 60 * 1_000)
    : null;
  atRestReconciliation?.unref();

  return {
    stop: async () => {
      retirement.stop();
      clearInterval(verification);
      clearInterval(emailChanges);
      if (atRestReconciliation) clearInterval(atRestReconciliation);
      if (ssf) clearInterval(ssf);
      await Promise.allSettled([
        logout.stop(),
        securityEffects.stop(),
        retention.stop(),
        deletionPurge.stop(),
        lifecycleReconciliation.stop(),
        subjectExportMaintenance.stop(),
        ssfDrain ?? Promise.resolve(),
      ]);
    },
  };
}
