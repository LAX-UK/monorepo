import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const TF_WORKFLOWS = [
  ".github/workflows/terraform-test-up.yml",
  ".github/workflows/terraform-test-down.yml",
  ".github/workflows/terraform-apply-test.yml",
  ".github/workflows/terraform-plan.yml",
  ".github/workflows/terraform-drift-check.yml",
];

const REQUIRED_TF_VAR = "TF_VAR_zoho_crm_sync_mode";

test("test Terraform workflows pass Zoho CRM control TF_VARs", () => {
  for (const path of TF_WORKFLOWS) {
    const text = readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
    assert.match(text, new RegExp(REQUIRED_TF_VAR), `${path} must set ${REQUIRED_TF_VAR}`);
    assert.match(text, /TF_VAR_zoho_crm_enabled_event_types/, path);
    assert.match(text, /TF_VAR_zoho_crm_lead_conversion_enabled/, path);
  }
});

test("Zoho CRM maintenance workflow pins sandbox API host", () => {
  const text = readFileSync(
    new URL("../../.github/workflows/zoho-crm-maintenance-test.yml", import.meta.url),
    "utf8",
  );
  assert.match(text, /ZOHO_CRM_API_HOST: https:\/\/sandbox\.zohoapis\.eu/);
  assert.match(text, /ZOHO_CRM_EXPECTED_ORG_TYPE: sandbox/);
  assert.match(text, /replay-crm-skipped/);
  assert.match(text, /delivery-status/);
  assert.match(text, /crm-delivery-status\.ts/);
});
