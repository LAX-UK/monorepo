#!/usr/bin/env node
import pg from "pg";

const authBase = (process.env.AUTH_BASE_URL ?? "https://test-auth.lax.bid").replace(/\/?$/, "");
const clientId = process.env.SSF_TEST_CLIENT_ID ?? "lax-bid-web";
const clientSecret = process.env.SSF_TEST_CLIENT_SECRET;
const endpoint = process.env.SSF_TEST_ENDPOINT ?? "https://test-api.lax.bid/ssf/events";
const databaseUrl = process.env.DATABASE_URL_OWNER;
const deliveryEnabled = process.env.SSF_DELIVERY_ENABLED === "true";
const failureRehearsal = process.env.SSF_FAILURE_REHEARSAL === "true";
const timeoutMs = Number(process.env.SSF_TEST_TIMEOUT_MS ?? 60_000);

if (!clientSecret || !databaseUrl) {
  throw new Error("SSF_TEST_CLIENT_SECRET and DATABASE_URL_OWNER are required");
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

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false },
});

try {
  await client.connect();
  const listed = await request("/ssf/stream");
  const streams = await body(listed);
  if (!listed.ok || !Array.isArray(streams)) {
    throw new Error(`SSF stream listing failed (${listed.status}): ${JSON.stringify(streams)}`);
  }
  let stream = streams.find((candidate) => candidate.delivery?.endpoint_url === endpoint);
  if (!stream) {
    const created = await request("/ssf/stream", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        delivery: { method: "urn:ietf:rfc:8935", endpoint_url: endpoint },
        events_requested: [
          "https://schemas.openid.net/secevent/caep/event-type/session-revoked",
          "https://schemas.openid.net/secevent/caep/event-type/credential-change",
          "https://schemas.openid.net/secevent/risc/event-type/account-disabled",
          "https://schemas.openid.net/secevent/risc/event-type/account-enabled",
          "https://schemas.openid.net/secevent/risc/event-type/account-purged",
          "https://schemas.openid.net/secevent/risc/event-type/identifier-recycled",
          "https://schemas.lax.bid/secevent/identity/event-type/account-merged",
        ],
      }),
    });
    stream = await body(created);
    if (created.status !== 201 || typeof stream?.stream_id !== "string") {
      throw new Error(`SSF stream creation failed (${created.status}): ${JSON.stringify(stream)}`);
    }
  }

  const desiredStatus = deliveryEnabled ? "enabled" : "disabled";
  const status = await request("/ssf/status", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ stream_id: stream.stream_id, status: desiredStatus }),
  });
  if (!status.ok) {
    throw new Error(
      `SSF status update failed (${status.status}): ${JSON.stringify(await body(status))}`,
    );
  }

  if (failureRehearsal) {
    if (!deliveryEnabled) {
      throw new Error("SSF_FAILURE_REHEARSAL requires SSF_DELIVERY_ENABLED=true");
    }
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
          state: `identity-staging-failure-${Date.now()}`,
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
          `SSF retry/dead-letter rehearsal failed: ${JSON.stringify(failedDelivery)}`,
        );
      }
      console.log(
        `SSF retry and dead-letter probe passed (${failedDelivery.attempt_count} attempts)`,
      );
    } finally {
      await client.query("UPDATE ssf_stream SET endpoint = $1, updated_at = now() WHERE id = $2", [
        endpoint,
        stream.stream_id,
      ]);
    }
  }

  const startedAt = new Date();
  const state = `identity-staging-${Date.now()}`;
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
    if (!deliveryEnabled || delivery?.status === "delivered") break;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  } while (Date.now() < deadline);

  if (!delivery) throw new Error("SSF verification did not create a durable delivery");
  if (!deliveryEnabled) {
    if (delivery.status !== "pending" || delivery.attempt_count !== 0) {
      throw new Error(`Disabled SSF attempted delivery: ${JSON.stringify(delivery)}`);
    }
    console.log("SSF disabled-state durability probe passed");
  } else {
    if (delivery.status !== "delivered" || delivery.last_status_code !== 202) {
      throw new Error(`SSF verification was not delivered: ${JSON.stringify(delivery)}`);
    }
    const replay = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/secevent+jwt" },
      body: delivery.set_token,
    });
    const replayBody = await body(replay);
    if (replay.status !== 400 || replayBody?.error !== "replayed_set") {
      throw new Error(
        `SSF receiver accepted replay (${replay.status}): ${JSON.stringify(replayBody)}`,
      );
    }
    console.log("SSF delivery, receiver verification, and replay rejection probes passed");
  }
} finally {
  await client.end().catch(() => undefined);
}
