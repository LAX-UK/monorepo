/**
 * Backfill historical `bid.first_for_user` and `bid.outbid` domain events.
 *
 * Dry-run (default):
 *   DATABASE_URL=... pnpm --filter @auction/db db:backfill-bid-milestone-events
 *
 * Apply:
 *   DATABASE_URL=... pnpm --filter @auction/db db:backfill-bid-milestone-events -- --apply
 *
 * Optional:
 *   --limit=5000
 *   --checkpoint-file=/tmp/bid-milestone.checkpoint.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import { bid, domainEvent } from "@auction/db/schema";
import { parseMoneyToMinorUnits } from "@auction/validators";
import { and, asc, eq, gt, or } from "drizzle-orm";
import { createDb } from "../client.js";

type Checkpoint = {
  lastBidId: string | null;
  lastCreatedAt: string | null;
  lotState: Record<
    string,
    {
      bidders: string[];
      winnerId: string | null;
      winningBidId: string | null;
      highAmount: string | null;
    }
  >;
};

function parseArgs(argv: string[]) {
  const apply = argv.includes("--apply");
  const limitArg = argv.find((arg) => arg.startsWith("--limit="));
  const checkpointArg = argv.find((arg) => arg.startsWith("--checkpoint-file="));
  const limit = limitArg ? Number.parseInt(limitArg.split("=")[1] ?? "", 10) : 5_000;
  if (Number.isNaN(limit) || limit <= 0) {
    throw new Error("--limit must be a positive integer");
  }
  const checkpointFile =
    checkpointArg?.split("=")[1] ?? ".backfill-bid-milestone-events.checkpoint.json";
  return { apply, limit, checkpointFile };
}

function loadCheckpoint(path: string): Checkpoint {
  try {
    const raw = readFileSync(path, "utf8");
    return JSON.parse(raw) as Checkpoint;
  } catch {
    return { lastBidId: null, lastCreatedAt: null, lotState: {} };
  }
}

function saveCheckpoint(path: string, checkpoint: Checkpoint) {
  writeFileSync(path, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
}

async function main() {
  const { apply, limit, checkpointFile } = parseArgs(process.argv.slice(2));
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required");
  }

  const db = createDb(url);
  const checkpoint = loadCheckpoint(checkpointFile);
  const checkpointDate = checkpoint.lastCreatedAt ? new Date(checkpoint.lastCreatedAt) : null;

  const rows = await db
    .select({
      id: bid.id,
      lotId: bid.lotId,
      bidderId: bid.bidderId,
      amount: bid.amount,
      createdAt: bid.createdAt,
    })
    .from(bid)
    .where(
      checkpointDate && checkpoint.lastBidId
        ? or(
            gt(bid.createdAt, checkpointDate),
            and(eq(bid.createdAt, checkpointDate), gt(bid.id, checkpoint.lastBidId)),
          )
        : undefined,
    )
    .orderBy(asc(bid.createdAt), asc(bid.id))
    .limit(limit);

  const lotState = new Map<
    string,
    {
      bidders: Set<string>;
      winnerId: string | null;
      winningBidId: string | null;
      highAmount: string | null;
    }
  >(
    Object.entries(checkpoint.lotState).map(([lotId, state]) => [
      lotId,
      {
        bidders: new Set(state.bidders),
        winnerId: state.winnerId,
        winningBidId: state.winningBidId,
        highAmount: state.highAmount,
      },
    ]),
  );

  let firstForUserCandidates = 0;
  let outbidCandidates = 0;
  let firstForUserInserted = 0;
  let outbidInserted = 0;

  for (const row of rows) {
    const state = lotState.get(row.lotId) ?? {
      bidders: new Set<string>(),
      winnerId: null,
      winningBidId: null,
      highAmount: null,
    };
    lotState.set(row.lotId, state);

    const isFirstForUser = !state.bidders.has(row.bidderId);
    state.bidders.add(row.bidderId);

    const beatsHigh =
      state.highAmount == null ||
      parseMoneyToMinorUnits(row.amount) > parseMoneyToMinorUnits(state.highAmount);
    const displacedWinnerId = beatsHigh ? state.winnerId : null;
    const displacedBidId = beatsHigh ? state.winningBidId : null;

    if (isFirstForUser) firstForUserCandidates++;
    if (displacedWinnerId && displacedBidId && displacedWinnerId !== row.bidderId) {
      outbidCandidates++;
    }

    if (apply) {
      if (isFirstForUser) {
        const inserted = await db
          .insert(domainEvent)
          .values({
            aggregateType: "bid",
            aggregateId: row.id,
            eventType: "bid.first_for_user",
            producer: "ops/backfill-bid-milestone",
            payload: {
              bidId: row.id,
              lotId: row.lotId,
              userId: row.bidderId,
              amountCents: Number(parseMoneyToMinorUnits(row.amount)),
              placedAt: row.createdAt.toISOString(),
            },
            actorUserId: row.bidderId,
            schemaVersion: 1,
          })
          .onConflictDoNothing()
          .returning({ id: domainEvent.id });
        if (inserted.length > 0) firstForUserInserted++;
      }

      if (displacedWinnerId && displacedBidId && displacedWinnerId !== row.bidderId) {
        const inserted = await db
          .insert(domainEvent)
          .values({
            aggregateType: "bid",
            aggregateId: displacedBidId,
            eventType: "bid.outbid",
            producer: "ops/backfill-bid-milestone",
            payload: {
              previousBidId: displacedBidId,
              displacedBidId,
              lotId: row.lotId,
              userId: displacedWinnerId,
              newHighAmountCents: Number(parseMoneyToMinorUnits(row.amount)),
            },
            actorUserId: row.bidderId,
            schemaVersion: 1,
          })
          .onConflictDoNothing()
          .returning({ id: domainEvent.id });
        if (inserted.length > 0) outbidInserted++;
      }
    }

    if (beatsHigh) {
      state.winnerId = row.bidderId;
      state.winningBidId = row.id;
      state.highAmount = row.amount;
    }

    checkpoint.lastBidId = row.id;
    checkpoint.lastCreatedAt = row.createdAt.toISOString();
    checkpoint.lotState = Object.fromEntries(
      [...lotState.entries()].map(([lotId, state]) => [
        lotId,
        {
          bidders: [...state.bidders],
          winnerId: state.winnerId,
          winningBidId: state.winningBidId,
          highAmount: state.highAmount,
        },
      ]),
    );
  }

  if (rows.length > 0) {
    saveCheckpoint(checkpointFile, checkpoint);
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        scanned: rows.length,
        firstForUserCandidates,
        outbidCandidates,
        firstForUserInserted: apply ? firstForUserInserted : undefined,
        outbidInserted: apply ? outbidInserted : undefined,
        checkpoint,
        checkpointFile,
      },
      null,
      2,
    ),
  );

  if (!apply) {
    console.log("Dry run only. Re-run with --apply to insert bid milestone events.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
