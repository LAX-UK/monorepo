#!/usr/bin/env node
/**
 * Hydrate Terraform image tag variables from the live App Platform spec (fail closed on rolling tags).
 */
import { readAppSpec } from "./assert-app-platform-spec.mjs";
import { readComponentImageTags } from "./resolve-affected-deploy-components.mjs";
import { resolveAppImageTag } from "./resolve-app-image-tag.mjs";

const SHA = /^[0-9a-f]{40}$/;

function parseArgs(argv) {
  let appId = "";
  let format = "github-env";
  let inputAppImageTag = "";
  let inputShopAdminImageTag = "";
  let inputAccountImageTag = "";
  let inputShopImageTag = "";
  let inputShopIdentityImageTag = "";
  let inputShopApiImageTag = "";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--app-id") appId = argv[++i] ?? "";
    if (argv[i] === "--format") format = argv[++i] ?? "github-env";
    if (argv[i] === "--input-app-image-tag") inputAppImageTag = argv[++i] ?? "";
    if (argv[i] === "--input-shop-admin-image-tag") inputShopAdminImageTag = argv[++i] ?? "";
    if (argv[i] === "--input-account-image-tag") inputAccountImageTag = argv[++i] ?? "";
    if (argv[i] === "--input-shop-image-tag") inputShopImageTag = argv[++i] ?? "";
    if (argv[i] === "--input-shop-identity-image-tag") inputShopIdentityImageTag = argv[++i] ?? "";
    if (argv[i] === "--input-shop-api-image-tag") inputShopApiImageTag = argv[++i] ?? "";
  }
  if (!appId) throw new Error("--app-id is required");
  if (format !== "github-env" && format !== "json") {
    throw new Error("--format must be github-env or json");
  }
  return {
    appId,
    format,
    inputAppImageTag: inputAppImageTag.trim(),
    inputShopAdminImageTag: inputShopAdminImageTag.trim(),
    inputAccountImageTag: inputAccountImageTag.trim(),
    inputShopImageTag: inputShopImageTag.trim(),
    inputShopIdentityImageTag: inputShopIdentityImageTag.trim(),
    inputShopApiImageTag: inputShopApiImageTag.trim(),
  };
}

function requireSha(
  label,
  tag,
  hint = "Pin immutable tags via app-deploy-test before Terraform apply.",
) {
  if (!SHA.test(tag ?? "")) {
    throw new Error(
      `Live ${label} image tag must be a 40-character git SHA (got "${tag || "(missing)"}"). ${hint}`,
    );
  }
  return tag;
}

function inputOrLive(label, input, live, hint) {
  return SHA.test(input) ? input : requireSha(label, live, hint);
}

/** Prefer explicit CLI/workflow pin over job-level TF_VAR_* before falling back to live App spec. */
export function coalesceImageSha(...candidates) {
  for (const candidate of candidates) {
    const trimmed = (candidate ?? "").trim();
    if (SHA.test(trimmed)) return trimmed;
  }
  return "";
}

export function resolveLiveTerraformImageTags(
  spec,
  {
    inputAppImageTag = "",
    inputShopAdminImageTag = "",
    inputAccountImageTag = "",
    inputShopImageTag = "",
    inputShopIdentityImageTag = "",
    inputShopApiImageTag = "",
  } = {},
) {
  const live = readComponentImageTags(spec);
  const appImageTag = resolveAppImageTag({
    inputTag: inputAppImageTag,
    liveTag: live.web ?? "",
  });
  return {
    app_image_tag: appImageTag,
    shop_identity_image_tag: inputOrLive(
      "shop-identity",
      inputShopIdentityImageTag,
      live["shop-identity"],
    ),
    shop_image_tag: inputOrLive("shop", inputShopImageTag, live.shop),
    shop_api_image_tag: inputOrLive("shop-api", inputShopApiImageTag, live["shop-api"]),
    shop_admin_image_tag: inputOrLive("shop-admin", inputShopAdminImageTag, live["shop-admin"]),
    account_image_tag: inputOrLive(
      "account",
      inputAccountImageTag,
      live.account,
      "Before the account component exists, pass account_sha (a SHA app-deploy-test built lax-test-account for).",
    ),
  };
}

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const spec = readAppSpec(parsed.appId);
  const tags = resolveLiveTerraformImageTags(spec, {
    inputAppImageTag: coalesceImageSha(parsed.inputAppImageTag, process.env.TF_VAR_app_image_tag),
    inputShopAdminImageTag: coalesceImageSha(
      parsed.inputShopAdminImageTag,
      process.env.TF_VAR_shop_admin_image_tag,
    ),
    inputAccountImageTag: coalesceImageSha(
      parsed.inputAccountImageTag,
      process.env.TF_VAR_account_image_tag,
    ),
    inputShopImageTag: coalesceImageSha(
      parsed.inputShopImageTag,
      process.env.TF_VAR_shop_image_tag,
    ),
    inputShopIdentityImageTag: coalesceImageSha(
      parsed.inputShopIdentityImageTag,
      process.env.TF_VAR_shop_identity_image_tag,
    ),
    inputShopApiImageTag: coalesceImageSha(
      parsed.inputShopApiImageTag,
      process.env.TF_VAR_shop_api_image_tag,
    ),
  });
  const { format } = parsed;
  if (format === "json") {
    process.stdout.write(`${JSON.stringify(tags, null, 2)}\n`);
    return;
  }
  for (const [key, value] of Object.entries(tags)) {
    const envKey = `TF_VAR_${key}`;
    process.stdout.write(`${envKey}=${value}\n`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
