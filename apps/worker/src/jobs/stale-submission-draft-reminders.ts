import type pino from "pino";

export async function runStaleSubmissionDraftRemindersJob(opts: {
  apiBaseUrl: string;
  cronSecret: string;
  log: pino.Logger;
}): Promise<void> {
  const base = opts.apiBaseUrl.replace(/\/$/, "");
  const url = `${base}/internal/jobs/stale-submission-draft-reminders`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Cron-Secret": opts.cronSecret,
    },
    body: "{}",
  });
  if (res.status === 503) {
    opts.log.warn({ url }, "stale submission draft reminders skipped (cron_not_configured)");
    return;
  }
  if (!res.ok) {
    const text = await res.text();
    opts.log.error({ status: res.status, body: text }, "stale submission draft reminders failed");
    throw new Error(`stale_submission_draft_reminders_failed:${res.status}`);
  }
  const json = (await res.json()) as { data?: { reminded?: number } };
  opts.log.info({ result: json.data }, "stale submission draft reminders completed");
}
