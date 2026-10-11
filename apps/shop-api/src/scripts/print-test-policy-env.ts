/**
 * Prints shop-api test/staging policy env vars documented in shop-v1-phase-gates.md.
 * Use in CI or local acceptance prep; does not mutate GitHub — ops flips vars in Terraform.
 */
const lines = [
  "# Shop phase flags (test defaults for staff-ops acceptance — adjust per gate checklist)",
  "SHOP_PORTAL_OWNERSHIP_ENABLED=true",
  "SHOP_ADMIN_ENABLED=true",
  "SHOP_PAYOUTS_ENABLED=false",
  "SHOP_THIRD_PARTY_ENABLED=false",
  "SHOP_ORIGINALS_ENABLED=false",
  "SHOP_MERCHANDISE_ENABLED=false",
  "# TEST placeholders (never copy to production without legal/finance sign-off)",
  "SHOP_VAT_STANDARD_RATE_BP=2000",
  "SHOP_CANCELLATION_DAYS_AFTER_POSSESSION=14",
  "SHOP_PERSONALISED_GOODS_CANCELLATION_EXEMPT=false",
];

console.log(lines.join("\n"));
