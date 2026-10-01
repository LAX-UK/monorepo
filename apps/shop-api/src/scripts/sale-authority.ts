import { closeDb, createDb } from "@auction/db";
import { shopSaleAuthorityRequest } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import { loadShopApiEnv } from "../env.js";
import { createDrizzleSaleAuthorityWriter } from "../infrastructure/drizzle-sale-authority.writer.js";

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

const subcommand = process.argv[2];
const operator = readArg("--operator")?.trim();
if (!operator) {
  throw new Error("--operator is required (e.g. ops:you@lax.bid)");
}

const env = loadShopApiEnv();
const db = createDb(env.DATABASE_URL_SHOP);
const writer = createDrizzleSaleAuthorityWriter(db, "observe");

try {
  if (subcommand === "list-pending") {
    const rows = await db
      .select()
      .from(shopSaleAuthorityRequest)
      .where(eq(shopSaleAuthorityRequest.status, "pending"));
    console.log(JSON.stringify(rows, null, 2));
  } else if (subcommand === "grant") {
    const requestId = readArg("--request-id")?.trim();
    const artworkId = readArg("--artwork")?.trim();
    const ownerPartyId = readArg("--owner-party")?.trim();
    const countRaw = readArg("--count");
    const authorisedCount = countRaw ? Number(countRaw) : undefined;
    if (authorisedCount === undefined || Number.isNaN(authorisedCount)) {
      throw new Error("--count is required");
    }
    if (requestId) {
      const [req] = await db
        .select()
        .from(shopSaleAuthorityRequest)
        .where(eq(shopSaleAuthorityRequest.id, requestId))
        .limit(1);
      if (!req) throw new Error("Request not found");
      const result = await writer.grantSaleAuthority({
        requestId,
        artworkId: req.artworkId,
        ownerPartyId: req.ownerPartyId,
        authorisedCount: authorisedCount ?? req.requestedCount,
        evidenceNote: readArg("--note")?.trim() ?? "Ops CLI grant",
        recordedBySubjectId: operator,
      });
      console.log(JSON.stringify(result, null, 2));
    } else if (artworkId && ownerPartyId) {
      const result = await writer.grantSaleAuthority({
        artworkId,
        ownerPartyId,
        authorisedCount,
        evidenceNote: readArg("--note")?.trim() ?? "Ops CLI grant",
        recordedBySubjectId: operator,
      });
      console.log(JSON.stringify(result, null, 2));
    } else {
      throw new Error("grant requires --request-id or (--artwork and --owner-party)");
    }
  } else {
    console.error("Usage: sale-authority list-pending | grant --operator <id> ...");
    process.exit(1);
  }
} finally {
  await closeDb(db);
}
