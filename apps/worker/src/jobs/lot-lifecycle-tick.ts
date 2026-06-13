import type pino from "pino";
import { postInternalCronJob } from "./post-internal-cron-job.js";

export async function runLotLifecycleTickJob(opts: {
  apiBaseUrl: string;
  cronSecret: string;
  log: pino.Logger;
}): Promise<void> {
  await postInternalCronJob({
    ...opts,
    path: "lot-lifecycle-tick",
    treat409AsSuccess: true,
  });
}
