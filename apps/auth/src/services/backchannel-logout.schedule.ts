import type { BackchannelLogoutDeliveryWorker } from "./backchannel-logout-delivery.worker.js";

export function startBackchannelLogoutSchedule(options: {
  service: Pick<BackchannelLogoutDeliveryWorker, "drain">;
  onError: (error: unknown) => void;
  intervalMs?: number;
}): { stop: () => Promise<void> } {
  let stopped = false;
  let inFlight: Promise<void> | null = null;
  const run = () => {
    if (stopped || inFlight) return;
    inFlight = options.service
      .drain()
      .then(() => undefined)
      .catch(options.onError)
      .finally(() => {
        inFlight = null;
      });
  };
  const timer = setInterval(run, options.intervalMs ?? 5_000);
  timer.unref();
  return {
    stop: async () => {
      stopped = true;
      clearInterval(timer);
      await inFlight;
    },
  };
}
