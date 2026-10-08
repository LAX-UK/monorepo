#!/usr/bin/env node
/**
 * Hydrate AUTH_* / SHOP_* contract env for terraform-test-up when workflow inputs
 * are empty but live App Platform pins were resolved into TF_VAR_*.
 */
import { appendFileSync } from "node:fs";
import { readAppSpec } from "./assert-app-platform-spec.mjs";
import { digestForTag, listTags } from "./registry-tag-poll.mjs";
import { readComponentImageTags } from "./resolve-affected-deploy-components.mjs";

const SHA = /^[0-9a-f]{40}$/;

function pickSha(inputEnv, tfVarEnv) {
  const input = (process.env[inputEnv] ?? "").trim();
  if (SHA.test(input)) return input;
  const tf = (process.env[tfVarEnv] ?? "").trim();
  if (SHA.test(tf)) return tf;
  return "";
}

function resolveDigest(repository, sha) {
  const digest = digestForTag(listTags(repository), sha);
  if (!digest) {
    throw new Error(`DOCR ${repository} has no immutable tag for ${sha}`);
  }
  return digest;
}

function writeEnv(key, value) {
  if (process.env.GITHUB_ENV) {
    appendFileSync(process.env.GITHUB_ENV, `${key}=${value}\n`);
  }
}

const appId = process.env.APP_ID ?? "";
let authFromLive = "";
if (appId) {
  const live = readComponentImageTags(readAppSpec(appId));
  if (SHA.test(live.auth ?? "")) authFromLive = live.auth;
}

const pairs = [
  ["AUTH_SHA", "INPUT_AUTH_SHA", "", "lax-test-auth", authFromLive],
  [
    "SHOP_IDENTITY_SHA",
    "INPUT_SHOP_IDENTITY_SHA",
    "TF_VAR_shop_identity_image_tag",
    "lax-test-shop-identity",
    "",
  ],
  ["SHOP_SHA", "INPUT_SHOP_SHA", "TF_VAR_shop_image_tag", "lax-test-shop", ""],
  ["SHOP_API_SHA", "INPUT_SHOP_API_SHA", "TF_VAR_shop_api_image_tag", "lax-test-shop-api", ""],
];

for (const [shaKey, inputKey, tfKey, repository, liveFallback] of pairs) {
  let sha = pickSha(inputKey, tfKey);
  if (!sha && liveFallback) sha = liveFallback;
  if (!sha) {
    throw new Error(
      `${shaKey} is required (workflow input, ${tfKey || "live auth tag"}, or live App Platform pin)`,
    );
  }
  const digestKey = shaKey.replace("_SHA", "_DIGEST");
  const digest = resolveDigest(repository, sha);
  writeEnv(shaKey, sha);
  writeEnv(digestKey, digest);
}

console.log("Staging image contract env prepared from live pins and DOCR digests");
