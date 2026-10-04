#!/usr/bin/env node
import { createShopApiContainer } from "../container.js";
import { loadShopApiEnv } from "../env.js";
import { seedAcceptanceStaffOperationsFixtures } from "../infrastructure/seed/acceptance-staff-operations-seed.js";

const env = loadShopApiEnv();
if (env.NODE_ENV === "production" && !process.argv.includes("--force")) {
  console.error("Refusing to seed acceptance staff operations in production without --force");
  process.exit(1);
}

const adminStaffSubjectId =
  process.env.SHOP_ACCEPTANCE_ADMIN_SUBJECT_ID?.trim() ||
  process.env.SHOP_ACCEPTANCE_PORTAL_SUBJECT_ID?.trim();
if (!adminStaffSubjectId) {
  console.error(
    "SHOP_ACCEPTANCE_ADMIN_SUBJECT_ID or SHOP_ACCEPTANCE_PORTAL_SUBJECT_ID is required",
  );
  process.exit(1);
}

const fixturesPath = process.env.SHOP_ACCEPTANCE_FIXTURES_PATH?.trim();
const container = createShopApiContainer(env);

try {
  const result = await seedAcceptanceStaffOperationsFixtures(container.db, {
    adminStaffSubjectId,
    ...(process.env.SHOP_ACCEPTANCE_CONSIGNOR_SUBJECT_ID?.trim()
      ? { consignorSubjectId: process.env.SHOP_ACCEPTANCE_CONSIGNOR_SUBJECT_ID.trim() }
      : {}),
    ...(process.env.SHOP_ACCEPTANCE_BUYER_SUBJECT_ID?.trim()
      ? { buyerSubjectId: process.env.SHOP_ACCEPTANCE_BUYER_SUBJECT_ID.trim() }
      : {}),
  });
  const payload = { ok: true as const, ...result };
  console.log(JSON.stringify(payload, null, 2));
  if (fixturesPath) {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(fixturesPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  }
} finally {
  await container.close();
}
