#!/usr/bin/env node
/**
 * Prints Phase 0 sandbox gates before Zoho CRM canary/live on test.
 * Does not call Zoho; operator completes UI + token checks, then sets GitHub test vars.
 */
const gates = [
  "Refresh token issued while Zoho UI is on LAX Integration Test (not production)",
  "GET https://sandbox.zohoapis.eu/crm/v8/org shows sandbox org type",
  "Leads: LAX_Subject_ID external (org-based); Lead_Source includes LAX Platform",
  "Contacts: LAX_Subject_ID external (org-based) — required for lead conversion",
  "Deals: LAX_Deal_Key external + unique; LAX Platform pipeline with Lot Won / Paid / Refunded",
  "COQL: select id from Deals where Contact_Name = '<contactId>' limit 200",
  "Review/disable sandbox workflows on Lead create/update/convert",
  "GitHub test: ZOHO OAuth secrets + ZOHO_CRM_* variables; Terraform test up after changes",
];

console.log("Zoho CRM sandbox prep checklist (LAX Integration Test):\n");
for (const [i, gate] of gates.entries()) {
  console.log(`${i + 1}. [ ] ${gate}`);
}
console.log("\nRun: node scripts/ci/zoho-sandbox-prep-checklist.mjs");
