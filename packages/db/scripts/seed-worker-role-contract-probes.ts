import { eq } from "drizzle-orm";
/**
 * Idempotent minimal rows for worker_app role contract live probes (CI worker-role-contract job).
 */
import { createDb } from "../src/index.js";
import { user } from "../src/schema/auth.js";
import { legalEntity } from "../src/schema/legal-entities.js";
import { lot } from "../src/schema/lots.js";

const PROBE_USER_ID = "worker-role-contract-probe-user";
const PROBE_LE_ID = "00000000-0000-4000-8000-000000000001";
const PROBE_LOT_ID = "00000000-0000-4000-8000-000000000002";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }
  const db = createDb(url);

  const existingUser = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, PROBE_USER_ID));
  if (existingUser.length === 0) {
    await db.insert(user).values({
      id: PROBE_USER_ID,
      name: "Worker Role Probe",
      email: "worker-role-contract-probe@lax.bid.local",
      emailVerified: true,
      role: "client",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  const existingLe = await db
    .select({ id: legalEntity.id })
    .from(legalEntity)
    .where(eq(legalEntity.id, PROBE_LE_ID));
  if (existingLe.length === 0) {
    await db.insert(legalEntity).values({
      id: PROBE_LE_ID,
      displayName: "Worker Role Probe LE",
      kind: "individual",
      subkind: "private_collector",
      createdByUserId: PROBE_USER_ID,
      status: "approved",
    });
  }

  const existingLot = await db.select({ id: lot.id }).from(lot).where(eq(lot.id, PROBE_LOT_ID));
  if (existingLot.length === 0) {
    const now = new Date();
    const end = new Date(now.getTime() + 86_400_000);
    await db.insert(lot).values({
      id: PROBE_LOT_ID,
      sellerLegalEntityId: PROBE_LE_ID,
      title: "Worker role contract probe lot",
      auctionType: "english",
      startingPrice: "100.00",
      currentPrice: "100.00",
      startTime: now,
      endTime: end,
      status: "draft",
    });
  }

  console.log("worker role contract probes seeded");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
