#!/usr/bin/env node
import pg from "pg";
import { buildPgConnectionConfig } from "../../packages/identity-db/src/pg/ssl.ts";

const authBase = (process.env.AUTH_BASE_URL ?? "https://test-auth.lax.bid").replace(/\/?$/, "");
const clientId = process.env.SSF_TEST_CLIENT_ID ?? "lax-bid-web";
const clientSecret = process.env.SSF_TEST_CLIENT_SECRET;
const endpoint = process.env.SSF_TEST_ENDPOINT ?? defaultEndpoint(clientId);
const databaseUrl = process.env.DATABASE_URL_OWNER;
const deliveryEnabled = process.env.SSF_DELIVERY_ENABLED === "true";
const failureRehearsal = process.env.SSF_FAILURE_REHEARSAL === "true";
const timeoutMs = Number(process.env.SSF_TEST_TIMEOUT_MS ?? 60_000);
const provisionedStreamId = `ssf-${clientId}`;

if (!clientSecret || !databaseUrl) {
  throw new Error("SSF_TEST_CLIENT_SECRET and DATABASE_URL_OWNER are required");
}
if (!deliveryEnabled) {
  throw new Error("SSF_DELIVERY_ENABLED=true is required to prove disabled and enabled delivery");
}
for (const [label, value] of [
  ["AUTH_BASE_URL", authBase],
  ["SSF_TEST_ENDPOINT", endpoint],
]) {
  if (new URL(value).protocol !== "https:") throw new Error(`${label} must use HTTPS`);
}
if (!Number.isFinite(timeoutMs) || timeoutMs < 1_000) {
  throw new Error("SSF_TEST_TIMEOUT_MS must be at least 1000");
}

const authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
const request = async (path, init = {}) => {
  const response = await fetch(`${authBase}${path}`, {
    ...init,
    headers: { authorization, ...(init.headers ?? {}) },
  });
  if (!/no-store/i.test(response.headers.get("cache-control") ?? "")) {
    throw new Error(`${path} omitted Cache-Control: no-store`);
  }
  return response;
};

async function body(response) {
  return response.json().catch(() => null);
}

function defaultEndpoint(receiverClientId) {
  if (receiverClientId === "lax-shop-web") return "https://test-shop.lax.bid/api/ssf/events";
  return "https://test-api.lax.bid/ssf/events";
}

const client = new pg.Client(buildPgConnectionConfig(databaseUrl));

try {
  await client.connect();
  const listed = await request("/ssf/stream");
  const streams = await body(listed);
  if (!listed.ok || !Array.isArray(streams)) {
    throw new Error(`SSF stream listing failed (${listed.status}): ${JSON.stringify(streams)}`);
  }
  const stream =
    streams.find((candidate) => candidate.stream_id === provisionedStreamId) ??
    streams.find((candidate) => candidate.delivery?.endpoint_url === endpoint);
  if (!stream) {
    throw new Error(
      `Provisioned SSF stream ${provisionedStreamId} for ${clientId} was not found at ${endpoint}`,
    );
  }
  if (stream.delivery?.endpoint_url !== endpoint) {
    throw new Error(
      `Provisioned SSF stream ${stream.stream_id} points at ${stream.delivery?.endpoint_url}, expected ${endpoint}`,
    );
  }

  let probeError;
  try {
    const disabledStatus = await request("/ssf/status", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ stream_id: stream.stream_id, status: "disabled" }),
    });
    if (!disabledStatus.ok) {
      throw new Error(
        `SSF disable failed (${disabledStatus.status}): ${JSON.stringify(await body(disabledStatus))}`,
      );
    }

    const disabledStartedAt = new Date();
    const disabledVerification = await request("/ssf/verification", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        stream_id: stream.stream_id,
        state: `identity-staging-disabled-${clientId}-${Date.now()}`,
      }),
    });
    if (disabledVerification.status !== 204) {
      throw new Error(`SSF disabled verification enqueue failed (${disabledVerification.status})`);
    }
    let disabledDelivery;
    const disabledDeadline = Date.now() + timeoutMs;
    do {
      const disabledResult = await client.query(
        `SELECT status, attempt_count, last_status_code
       FROM ssf_delivery
       WHERE stream_id = $1
         AND event_type = 'https://schemas.openid.net/secevent/ssf/event-type/verification'
         AND created_at >= $2
       ORDER BY created_at DESC
       LIMIT 1`,
        [stream.stream_id, disabledStartedAt],
      );
      disabledDelivery = disabledResult.rows[0];
      if (disabledDelivery?.status === "delivered") break;
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    } while (Date.now() < disabledDeadline);
    if (disabledDelivery?.status !== "delivered" || disabledDelivery.last_status_code !== 202) {
      throw new Error(
        `Disabled-stream verification was not delivered for ${clientId}: ${JSON.stringify(disabledDelivery)}`,
      );
    }
    console.log(`SSF pre-enable receiver verification passed for ${clientId}`);

    const enabledStatus = await request("/ssf/status", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ stream_id: stream.stream_id, status: "enabled" }),
    });
    if (!enabledStatus.ok) {
      throw new Error(
        `SSF enable failed (${enabledStatus.status}): ${JSON.stringify(await body(enabledStatus))}`,
      );
    }

    if (failureRehearsal) {
      const failedStartedAt = new Date();
      await client.query("UPDATE ssf_stream SET endpoint = $1, updated_at = now() WHERE id = $2", [
        "https://ssf-failure-probe.invalid/events",
        stream.stream_id,
      ]);
      try {
        const failedVerification = await request("/ssf/verification", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            stream_id: stream.stream_id,
            state: `identity-staging-failure-${clientId}-${Date.now()}`,
          }),
        });
        if (failedVerification.status !== 204) {
          throw new Error(`SSF failure verification enqueue failed (${failedVerification.status})`);
        }
        const failureDeadline = Date.now() + timeoutMs;
        let failedDelivery;
        do {
          const result = await client.query(
            `SELECT id, status, attempt_count, last_error
           FROM ssf_delivery
           WHERE stream_id = $1
             AND event_type = 'https://schemas.openid.net/secevent/ssf/event-type/verification'
             AND created_at >= $2
           ORDER BY created_at DESC
           LIMIT 1`,
            [stream.stream_id, failedStartedAt],
          );
          failedDelivery = result.rows[0];
          if (failedDelivery?.status === "failed") break;
          if (failedDelivery?.status === "pending" && failedDelivery.attempt_count > 0) {
            await client.query(
              "UPDATE ssf_delivery SET next_attempt_at = now() WHERE id = $1 AND status = 'pending'",
              [failedDelivery.id],
            );
          }
          await new Promise((resolve) => setTimeout(resolve, 1_000));
        } while (Date.now() < failureDeadline);
        if (
          failedDelivery?.status !== "failed" ||
          failedDelivery.attempt_count < 2 ||
          typeof failedDelivery.last_error !== "string"
        ) {
          throw new Error(
            `SSF retry/dead-letter rehearsal failed for ${clientId}: ${JSON.stringify(failedDelivery)}`,
          );
        }
        console.log(
          `SSF retry and dead-letter probe passed for ${clientId} (${failedDelivery.attempt_count} attempts)`,
        );
      } finally {
        await client.query(
          "UPDATE ssf_stream SET endpoint = $1, updated_at = now() WHERE id = $2",
          [endpoint, stream.stream_id],
        );
      }
    }

    const startedAt = new Date();
    const state = `identity-staging-${clientId}-${Date.now()}`;
    const verification = await request("/ssf/verification", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ stream_id: stream.stream_id, state }),
    });
    if (verification.status !== 204) {
      throw new Error(`SSF verification enqueue failed (${verification.status})`);
    }

    let delivery;
    const deadline = Date.now() + timeoutMs;
    do {
      const result = await client.query(
        `SELECT status, attempt_count, last_status_code, last_error, set_token, jti
       FROM ssf_delivery
       WHERE stream_id = $1
         AND event_type = 'https://schemas.openid.net/secevent/ssf/event-type/verification'
         AND created_at >= $2
       ORDER BY created_at DESC
       LIMIT 1`,
        [stream.stream_id, startedAt],
      );
      delivery = result.rows[0];
      if (delivery?.status === "delivered") break;
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    } while (Date.now() < deadline);

    if (!delivery) {
      throw new Error(`SSF verification did not create a durable delivery for ${clientId}`);
    }
    if (delivery.status !== "delivered" || delivery.last_status_code !== 202) {
      throw new Error(
        `SSF verification was not delivered for ${clientId}: ${JSON.stringify(delivery)}`,
      );
    }
    const replay = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/secevent+jwt" },
      body: delivery.set_token,
    });
    const replayBody = await body(replay);
    if (replay.status !== 400 || replayBody?.error !== "replayed_set") {
      throw new Error(
        `SSF receiver accepted replay for ${clientId} (${replay.status}): ${JSON.stringify(replayBody)}`,
      );
    }
    console.log(
      `SSF delivery, receiver verification, and replay rejection probes passed for ${clientId}`,
    );
  } catch (error) {
    probeError = error;
  }
  const restoreStatus = await request("/ssf/status", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ stream_id: stream.stream_id, status: "enabled" }),
  });
  if (!restoreStatus.ok) {
    const restoreError = new Error(
      `SSF final enabled-state restoration failed (${restoreStatus.status}): ${JSON.stringify(
        await body(restoreStatus),
      )}`,
    );
    if (probeError) throw new AggregateError([probeError, restoreError]);
    throw restoreError;
  }
  if (probeError) throw probeError;
} finally {
  await client.end().catch(() => undefined);
}
