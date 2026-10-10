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
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--app-id") appId = argv[++i] ?? "";
    if (argv[i] === "--format") format = argv[++i] ?? "github-env";
    if (argv[i] === "--input-app-image-tag") inputAppImageTag = argv[++i] ?? "";
    if (argv[i] === "--input-shop-admin-image-tag") inputShopAdminImageTag = argv[++i] ?? "";
    if (argv[i] === "--input-account-image-tag") inputAccountImageTag = argv[++i] ?? "";
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

export function resolveLiveTerraformImageTags(
  spec,
  { inputAppImageTag = "", inputShopAdminImageTag = "", inputAccountImageTag = "" } = {},
) {
  const live = readComponentImageTags(spec);
  const appImageTag = resolveAppImageTag({
    inputTag: inputAppImageTag,
    liveTag: live.web ?? "",
  });
  return {
    app_image_tag: appImageTag,
    shop_identity_image_tag: requireSha("shop-identity", live["shop-identity"]),
    shop_image_tag: requireSha("shop", live.shop),
    shop_api_image_tag: requireSha("shop-api", live["shop-api"]),
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
  const { appId, format, inputAppImageTag, inputShopAdminImageTag, inputAccountImageTag } =
    parseArgs(process.argv.slice(2));
  const spec = readAppSpec(appId);
  const tags = resolveLiveTerraformImageTags(spec, {
    inputAppImageTag,
    inputShopAdminImageTag,
    inputAccountImageTag,
  });
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
