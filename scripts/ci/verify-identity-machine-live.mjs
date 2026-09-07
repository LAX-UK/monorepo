#!/usr/bin/env node
const authBase = (process.env.AUTH_BASE_URL ?? "https://test-auth.lax.bid").replace(/\/+$/, "");
const clientId = process.env.IDENTITY_MACHINE_CLIENT_ID;
const clientSecret = process.env.IDENTITY_MACHINE_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  throw new Error("IDENTITY_MACHINE_CLIENT_ID and IDENTITY_MACHINE_CLIENT_SECRET are required");
}
if (new URL(authBase).protocol !== "https:") throw new Error("AUTH_BASE_URL must use HTTPS");

const basic = `Basic ${Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64")}`;

async function form(path, body, authorization = basic) {
  return fetch(`${authBase}${path}`, {
    method: "POST",
    headers: {
      authorization,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body),
  });
}

function assertNoStore(response, label) {
  if (!/no-store/i.test(response.headers.get("cache-control") ?? "")) {
    throw new Error(`${label} did not return Cache-Control: no-store`);
  }
}

async function main() {
  const issued = await form("/internal/oauth/token", {
    grant_type: "client_credentials",
    scope: "identity.lifecycle",
  });
  assertNoStore(issued, "machine token issue");
  const issuedBody = await issued.json();
  if (!issued.ok || typeof issuedBody.access_token !== "string" || issuedBody.expires_in !== 300) {
    throw new Error(`machine token issue failed (${issued.status}): ${JSON.stringify(issuedBody)}`);
  }

  const token = issuedBody.access_token;
  const active = await form("/internal/oauth/introspect", { token });
  assertNoStore(active, "machine token introspection");
  const activeBody = await active.json();
  if (!active.ok || activeBody.active !== true || activeBody.scope !== "identity.lifecycle") {
    throw new Error(`machine token was not active: ${JSON.stringify(activeBody)}`);
  }

  const revoked = await form("/internal/oauth/revoke", { token });
  assertNoStore(revoked, "machine token revocation");
  if (!revoked.ok) throw new Error(`machine token revocation failed (${revoked.status})`);

  const inactive = await form("/internal/oauth/introspect", { token });
  const inactiveBody = await inactive.json();
  if (!inactive.ok || inactiveBody.active !== false) {
    throw new Error(`revoked machine token remained active: ${JSON.stringify(inactiveBody)}`);
  }
  const protectedResponse = await fetch(`${authBase}/internal/identity/subjects/live-probe`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (protectedResponse.status !== 401) {
    throw new Error(
      `revoked machine token reached a protected route (${protectedResponse.status})`,
    );
  }

  const forgedOrigin = await fetch(`${authBase}/api/auth/sign-in/email`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://attacker.invalid",
    },
    body: JSON.stringify({ email: "nobody@example.invalid", password: "invalid" }),
  });
  if (forgedOrigin.status !== 403) {
    throw new Error(`forged browser origin was not rejected (${forgedOrigin.status})`);
  }

  let limited = false;
  const invalid = `Basic ${Buffer.from(`${clientId}:invalid-secret`, "utf8").toString("base64")}`;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const response = await form(
      "/internal/oauth/introspect",
      { token: "invalid-rate-limit-probe" },
      invalid,
    );
    if (response.status === 429) {
      if (!response.headers.get("retry-after")) {
        throw new Error("machine rate limit omitted Retry-After");
      }
      limited = true;
      break;
    }
  }
  if (!limited) throw new Error("machine credential rate limit did not activate");

  console.log("Identity machine issue/introspect/revoke, origin, and rate-limit probes passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
