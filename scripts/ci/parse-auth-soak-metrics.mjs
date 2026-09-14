#!/usr/bin/env node
/**
 * Parses Auth /metrics text into soak SLI counters used by staging evaluation.
 */

function parseLabeledCounter(lines, metricName) {
  const totals = {};
  let unlabeled = 0;
  for (const line of lines) {
    if (line.startsWith("#") || !line.startsWith(metricName)) continue;
    const match = line.match(/^(\S+?)(\{[^}]+\})?\s+(\S+)/);
    if (!match) continue;
    const value = Number(match[3]);
    if (!Number.isFinite(value)) continue;
    const labels = match[2];
    if (!labels) {
      unlabeled += value;
      continue;
    }
    const status = /status="([^"]+)"/.exec(labels)?.[1] ?? "unknown";
    totals[status] = (totals[status] ?? 0) + value;
  }
  return { unlabeled, byStatus: totals };
}

export function parseAuthSoakMetrics(metricsText) {
  const lines = metricsText.split("\n");
  const http = parseLabeledCounter(lines, "auction_auth_issuer_http_outcomes_total");
  const httpTotal =
    Object.values(http.byStatus).reduce((sum, value) => sum + value, 0) + http.unlabeled;
  const http5xx = (http.byStatus["5xx"] ?? 0) + (http.byStatus.server_error ?? 0);
  const ssf = parseLabeledCounter(lines, "auction_auth_ssf_delivery_outcomes_total");
  const backchannel = parseLabeledCounter(
    lines,
    "auction_auth_backchannel_delivery_outcomes_total",
  );
  const refresh = parseLabeledCounter(lines, "auction_auth_refresh_rotation_outcomes_total");
  const lifecycle = parseLabeledCounter(lines, "auction_auth_identity_lifecycle_operations_total");

  let atRestPending = null;
  for (const line of lines) {
    if (line.startsWith("auction_auth_at_rest_pending ") && !line.startsWith("#")) {
      atRestPending = Number(line.split(/\s+/)[1]);
    }
  }

  const operations =
    Object.values(refresh.byStatus).reduce((sum, value) => sum + value, 0) +
    refresh.unlabeled +
    Object.values(lifecycle.byStatus).reduce((sum, value) => sum + value, 0) +
    lifecycle.unlabeled +
    Object.values(ssf.byStatus).reduce((sum, value) => sum + value, 0) +
    ssf.unlabeled;

  const ssfFailed = (ssf.byStatus.failed ?? 0) + (ssf.byStatus.dead_letter ?? 0);
  const backchannelFailed = (backchannel.byStatus.failed ?? 0) + (backchannel.byStatus.error ?? 0);

  return {
    operations,
    httpRequestsTotal: httpTotal,
    http5xxTotal: http5xx,
    http5xxRate: httpTotal > 0 ? http5xx / httpTotal : 0,
    ssfDeliveryFailedTotal: ssfFailed,
    backchannelDeliveryFailedTotal: backchannelFailed,
    authAtRestPending: atRestPending,
  };
}
