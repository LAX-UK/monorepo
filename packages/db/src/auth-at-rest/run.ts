import { createEnvelopeCrypto, parseAuthDekKey } from "@auction/identity-contracts";
import pg from "pg";
import { buildPgConnectionConfig } from "../ssl.js";
import {
  applyAuthAtRestBackfill,
  formatAuthAtRestInventory,
  inventoryAuthAtRest,
  verifyAuthAtRestComplete,
} from "./apply.js";
import { releaseAuthAtRestLock, tryAcquireAuthAtRestLock } from "./lock.js";

export type AuthAtRestCommandMode = "inventory" | "apply" | "verify";

export type AuthAtRestCommandOptions = {
  mode: AuthAtRestCommandMode;
  databaseUrl: string;
  authDekKey?: string | undefined;
  batchSize?: number | undefined;
};

const DEFAULT_BATCH_SIZE = 100;

function resolveDatabaseUrl(): string {
  return process.env.DATABASE_URL ?? process.env.DATABASE_URL_AUTH ?? "";
}

function parseMode(argv: string[]): AuthAtRestCommandMode {
  if (argv.includes("--apply")) return "apply";
  if (argv.includes("--verify")) return "verify";
  return "inventory";
}

export function parseAuthAtRestArgv(
  argv: string[] = process.argv.slice(2),
): AuthAtRestCommandOptions {
  const batchArg = argv.find((arg) => arg.startsWith("--batch-size="));
  const batchSize = batchArg ? Number(batchArg.slice("--batch-size=".length)) : DEFAULT_BATCH_SIZE;
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1000) {
    throw new Error("--batch-size must be an integer between 1 and 1000");
  }
  const mode = parseMode(argv);
  const databaseUrl = resolveDatabaseUrl();
  if (!databaseUrl) {
    throw new Error("Set DATABASE_URL or DATABASE_URL_AUTH");
  }
  const authDekKey = process.env.AUTH_DEK_KEY;
  if ((mode === "apply" || mode === "verify") && !authDekKey?.trim()) {
    throw new Error("AUTH_DEK_KEY is required for --apply and --verify");
  }
  return {
    mode,
    databaseUrl,
    authDekKey,
    batchSize,
  };
}

export async function runAuthAtRestCommand(
  options: AuthAtRestCommandOptions,
): Promise<{ mode: AuthAtRestCommandMode; output: string }> {
  const pool = new pg.Pool(buildPgConnectionConfig(options.databaseUrl));
  const client = await pool.connect();
  try {
    if (options.mode === "inventory") {
      const counts = await inventoryAuthAtRest(pool);
      return { mode: options.mode, output: formatAuthAtRestInventory(counts) };
    }

    if (options.mode === "verify") {
      const crypto = createEnvelopeCrypto(parseAuthDekKey(options.authDekKey ?? ""));
      await verifyAuthAtRestComplete(pool, crypto, options.batchSize ?? DEFAULT_BATCH_SIZE);
      return { mode: options.mode, output: JSON.stringify({ status: "complete" }) };
    }

    const acquired = await tryAcquireAuthAtRestLock(client);
    if (!acquired) {
      throw new Error("auth_at_rest_backfill_lock_not_acquired");
    }

    try {
      const before = await inventoryAuthAtRest(pool);
      console.error(`auth_at_rest_inventory_before=${formatAuthAtRestInventory(before)}`);

      const crypto = createEnvelopeCrypto(parseAuthDekKey(options.authDekKey ?? ""));
      const updated = await applyAuthAtRestBackfill(pool, {
        crypto,
        batchSize: options.batchSize ?? DEFAULT_BATCH_SIZE,
        onBatch: (progress) => {
          console.error(`auth_at_rest_batch=${JSON.stringify(progress)}`);
        },
      });

      await verifyAuthAtRestComplete(pool, crypto, options.batchSize ?? DEFAULT_BATCH_SIZE);
      return {
        mode: options.mode,
        output: JSON.stringify({ status: "applied", updated }),
      };
    } finally {
      await releaseAuthAtRestLock(client);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const options = parseAuthAtRestArgv(argv);
  const result = await runAuthAtRestCommand(options);
  console.log(result.output);
}
