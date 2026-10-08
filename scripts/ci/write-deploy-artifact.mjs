#!/usr/bin/env node
import { writeFileSync } from "node:fs";

const payload = {
  target_sha: process.env.TARGET_SHA ?? "",
  prior_deployment_id: process.env.PRIOR_DEPLOYMENT_ID ?? "",
  deployment_id: process.env.DEPLOYMENT_ID ?? "",
  affected_components: JSON.parse(process.env.AFFECTED_COMPONENTS ?? "[]"),
  tag_map: JSON.parse(process.env.TAG_MAP ?? "{}"),
  smoke_result: process.env.SMOKE_RESULT ?? "",
  rollback_result: process.env.ROLLBACK_RESULT ?? "",
};

writeFileSync("deploy-artifact.json", `${JSON.stringify(payload, null, 2)}\n`);
