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
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--app-id") appId = argv[++i] ?? "";
    if (argv[i] === "--format") format = argv[++i] ?? "github-env";
    if (argv[i] === "--input-app-image-tag") inputAppImageTag = argv[++i] ?? "";
  }
  if (!appId) throw new Error("--app-id is required");
  if (format !== "github-env" && format !== "json") {
    throw new Error("--format must be github-env or json");
  }
  return { appId, format, inputAppImageTag: inputAppImageTag.trim() };
}

function requireSha(label, tag) {
  if (!SHA.test(tag ?? "")) {
    throw new Error(
      `Live ${label} image tag must be a 40-character git SHA (got "${tag || "(missing)"}"). Pin immutable tags via app-deploy-test before Terraform apply.`,
    );
  }
  return tag;
}

export function resolveLiveTerraformImageTags(spec, { inputAppImageTag = "" } = {}) {
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
    shop_admin_image_tag: requireSha("shop-admin", live["shop-admin"]),
  };
}

function main() {
  const { appId, format, inputAppImageTag } = parseArgs(process.argv.slice(2));
  const spec = readAppSpec(appId);
  const tags = resolveLiveTerraformImageTags(spec, { inputAppImageTag });
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
