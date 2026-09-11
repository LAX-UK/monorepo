#!/usr/bin/env node

const token = process.env.CLOUDFLARE_API_TOKEN ?? process.env.TF_VAR_cloudflare_api_token;
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? process.env.TF_VAR_cloudflare_account_id;
const zones = ["lax.bid"];

if (!token || !accountId) {
  throw new Error("CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are required");
}

for (const zoneName of zones) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/zones?name=${encodeURIComponent(zoneName)}&account.id=${encodeURIComponent(accountId)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    },
  );
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success || !Array.isArray(body.result) || body.result.length !== 1) {
    throw new Error(`Cloudflare token cannot access zone ${zoneName}`);
  }
  console.log(`Cloudflare zone accessible: ${zoneName}`);
}
