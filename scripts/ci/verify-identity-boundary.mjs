#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const mode = process.argv.includes("--live") ? "live" : "fixture";
const authBase = process.env.AUTH_BASE_URL ?? "http://localhost:3003";
const apiBase = process.env.API_BASE_URL ?? "http://localhost:3001";
const shopBase = process.env.SHOP_IDENTITY_BASE_URL;
const shopRequired = process.env.IDENTITY_BOUNDARY_SHOP_REQUIRED === "true";

const focusedTests = [
  [
    "@auction/identity-contracts",
    ["src/discovery.test.ts", "src/verify-token.test.ts", "src/ssf.test.ts"],
  ],
  [
    "@auction/api",
    [
      "src/infrastructure/jwt-authenticator.conformance.test.ts",
      "src/infrastructure/bid-ssf-retention.schedule.test.ts",
      "src/middleware/bid-scope-policy.test.ts",
      "src/middleware/require-auth.scope.test.ts",
      "src/routes/ssf-events.test.ts",
    ],
  ],
  [
    "@auction/ws",
    ["src/resource-authenticator.test.ts", "src/handlers/socket-handler-registry.test.ts"],
  ],
  [
    "@auction/auth-app",
    [
      "src/middleware/oauth-token-request-context.test.ts",
      "src/routes/token-exchange.routes.test.ts",
      "src/services/backchannel-logout.service.test.ts",
      "src/services/backchannel-logout.schedule.test.ts",
      "src/infrastructure/identity-retention.schedule.test.ts",
      "src/services/oidc-session-coordinator.test.ts",
      "src/services/ssf-delivery.worker.test.ts",
      "src/services/ssf.service.test.ts",
      "src/routes/ssf.routes.test.ts",
    ],
  ],
  [
    "@auction/shop-identity",
    [
      "src/oidc.test.ts",
      "src/session.test.ts",
      "src/ssf.test.ts",
      "src/retention.schedule.test.ts",
    ],
  ],
  [
    "@auction/web",
    [
      "src/lib/bff/session-store.server.test.ts",
      "src/lib/bff/token-service.server.test.ts",
      "src/lib/bff/proxy-policy.test.ts",
      "src/app/api/bff/[...path]/route.test.ts",
      "src/app/api/auth/backchannel-logout/route.test.ts",
    ],
  ],
];

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", env: process.env });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with ${result.status ?? "no status"}`);
  }
}

function trackedText() {
  const result = spawnSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { encoding: "utf8" },
  );
  if (result.status !== 0) throw new Error("unable to enumerate repository files");
  return result.stdout
    .split("\0")
    .filter(Boolean)
    .filter((path) => !/\.(?:png|jpe?g|gif|webp|ico|woff2?|pdf|zip|gz|lockb)$/i.test(path))
    .map((path) => {
      try {
        return [path, readFileSync(path, "utf8")];
      } catch {
        return [path, ""];
      }
    });
}

function verifyFileContract(path, required, forbidden) {
  const text = readFileSync(path, "utf8");
  for (const [pattern, label] of required) {
    if (!pattern.test(text)) throw new Error(`${label} is missing from ${path}`);
  }
  for (const [pattern, label] of forbidden) {
    if (pattern.test(text)) throw new Error(`${label} returned in ${path}`);
  }
}

function verifyStaticContracts() {
  const files = trackedText();
  const retired = [
    [new RegExp(["shop", "ify"].join(""), "i"), "retired commerce vendor"],
    [new RegExp(["word", "press"].join(""), "i"), "retired CMS vendor"],
    [new RegExp(["lax", "\\.", "shop"].join(""), "i"), "retired shop domain"],
    [new RegExp(["lax", "-shop-", "proof"].join(""), "i"), "retired shop client"],
    [new RegExp(["Remote", "Session", "Authenticator"].join("")), "retired remote authenticator"],
    [new RegExp(["Composite", "Authenticator"].join("")), "retired composite authenticator"],
    [new RegExp(["cross", "Sub", "Domain", "Cookies"].join("")), "retired cookie option"],
  ];
  for (const [pattern, label] of retired) {
    const matches = files.filter(([, text]) => pattern.test(text)).map(([path]) => path);
    if (matches.length > 0) throw new Error(`${label} remains in: ${matches.join(", ")}`);
  }

  verifyFileContract(
    "apps/web/src/lib/bff/session-store.server.ts",
    [
      [/INVALIDATE_INDEX_SCRIPT/, "indexed BFF invalidation"],
      [/identityIndexKey\(/, "BFF sid/sub reverse index"],
    ],
    [
      [/\.\s*scan\s*\(/, "Redis SCAN session invalidation"],
      [/\bscanStream\s*\(/, "Redis scan-stream session invalidation"],
    ],
  );
  verifyFileContract(
    "apps/api/src/services/interfaces/authenticator.ts",
    [[/scopes:\s*readonly string\[\]/, "required authenticated-user scopes"]],
    [[/scopes\?\s*:/, "optional authenticated-user scopes"]],
  );
  verifyFileContract(
    "apps/api/src/infrastructure/jwt-authenticator.ts",
    [[/scopes:\s*\n?\s*typeof verified\.payload\.scope/, "total JWT scope normalization"]],
    [[/scopes\?\s*:/, "optional JWT scopes"]],
  );

  const journal = JSON.parse(readFileSync("packages/db/drizzle/meta/_journal.json", "utf8"));
  const tags = new Set(journal.entries.map((entry) => entry.tag));
  for (const tag of [
    "0146_oauth_consent_client_user_unique",
    "0147_oidc_rp_sessions",
    "0148_oidc_logout_and_shop_sessions",
    "0149_ssf_signal_transport",
    "0150_remove_shop_session_id_token",
  ]) {
    if (!tags.has(tag)) throw new Error(`migration registry is missing ${tag}`);
    const version = tag.slice(0, 4);
    readFileSync(`packages/db/drizzle/${tag}.sql`);
    readFileSync(`packages/db/drizzle/${version}_rollback.sql`);
  }
}

function runFixtureVerification() {
  verifyStaticContracts();
  for (const [packageName] of focusedTests) {
    run("pnpm", ["--filter", `${packageName}^...`, "run", "build"]);
  }
  for (const [packageName, tests] of focusedTests) {
    run("pnpm", ["--filter", packageName, "exec", "vitest", "run", ...tests]);
  }
}

async function runLiveVerification() {
  const authDiscovery = await fetchJson(`${authBase}/.well-known/openid-configuration`);
  const issuer = authBase.replace(/\/+$/, "");
  const expected = {
    issuer,
    authorization_endpoint: `${issuer}/api/auth/oauth2/authorize`,
    token_endpoint: `${issuer}/api/auth/oauth2/token`,
    userinfo_endpoint: `${issuer}/api/auth/oauth2/userinfo`,
    end_session_endpoint: `${issuer}/api/auth/oauth2/endsession`,
    revocation_endpoint: `${issuer}/api/auth/oauth2/revoke`,
    introspection_endpoint: `${issuer}/api/auth/oauth2/introspect`,
    jwks_uri: `${issuer}/.well-known/jwks.json`,
    response_types_supported: ["code"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: [
      "openid",
      "profile",
      "email",
      "offline_access",
      "bid.read",
      "bid.write",
      "shop.read",
      "shop.write",
    ],
    token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post", "none"],
  };
  for (const [key, value] of Object.entries(expected)) {
    if (JSON.stringify(authDiscovery[key]) !== JSON.stringify(value)) {
      throw new Error(`unexpected discovery ${key}: ${JSON.stringify(authDiscovery[key])}`);
    }
  }
  const authJwks = await fetchJson(`${authBase}/.well-known/jwks.json`);
  if (!Array.isArray(authJwks.keys) || authJwks.keys.length === 0) {
    throw new Error("canonical JWKS has no signing keys");
  }

  for (const path of ["/.well-known/openid-configuration", "/.well-known/jwks.json"]) {
    const retired = await fetch(`${apiBase}${path}`);
    if (retired.status !== 404) {
      throw new Error(`API issuer route must be retired: ${path} -> ${retired.status}`);
    }
  }

  const session = await fetch(`${authBase}/api/auth/get-session`, {
    headers: { accept: "application/json" },
  });
  if (!session.ok) {
    throw new Error(`canonical get-session unavailable: ${session.status}`);
  }

  if (shopRequired && !shopBase) {
    throw new Error("SHOP_IDENTITY_BASE_URL is required when Shop verification is enabled");
  }
  if (shopBase) {
    const shopHealth = await fetch(`${shopBase}/health/ready`);
    if (!shopHealth.ok) throw new Error(`Shop Identity app unhealthy: ${shopHealth.status}`);
  }
}

async function main() {
  if (mode === "live") {
    verifyStaticContracts();
    await runLiveVerification();
  } else {
    runFixtureVerification();
  }
  console.log(`identity boundary verification passed (${mode})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
