import { ZOHO_MIRROR_MODES, type ZohoMirrorMode } from "@auction/types";
import {
  ZOHO_CATCH_UP_CONSUMERS,
  type ZohoCatchUpConsumer,
  isZohoCatchUpConsumer,
} from "../integrations/zoho/zoho-go-live-catch-up.js";

export type ZohoCatchUpArgs = {
  consumer: ZohoCatchUpConsumer;
  apply: boolean;
  limit?: number;
};

const USAGE = `usage: zoho:catch-up-after-live --consumer <${Object.keys(ZOHO_CATCH_UP_CONSUMERS).join("|")}> [--dry-run] [--limit N]`;

/** `--consumer <name> [--dry-run] [--limit N]`; anything else is refused. */
export function parseZohoCatchUpArgs(argv: readonly string[]): ZohoCatchUpArgs {
  let consumer: string | undefined;
  let apply = true;
  let limit: number | undefined;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] as string;
    if (arg === "--") continue;
    if (arg === "--dry-run") apply = false;
    else if (arg === "--consumer" && argv[i + 1] !== undefined) consumer = argv[++i];
    else if (arg === "--limit" && argv[i + 1] !== undefined) {
      const value = argv[++i] as string;
      if (!/^[1-9]\d*$/.test(value))
        throw new Error(`--limit must be a positive whole number\n${USAGE}`);
      limit = Number(value);
    } else throw new Error(`unknown or incomplete option: ${arg}\n${USAGE}`);
  }
  if (consumer === undefined || !isZohoCatchUpConsumer(consumer)) {
    throw new Error(`--consumer is required and must be one of the Zoho write-backs\n${USAGE}`);
  }
  return { consumer, apply, ...(limit === undefined ? {} : { limit }) };
}

/** The consumer's mode as the worker reads it (`off` when unset); an unknown value is refused. */
export function zohoCatchUpMode(
  consumer: ZohoCatchUpConsumer,
  env: Readonly<Record<string, string | undefined>>,
): ZohoMirrorMode {
  const name = ZOHO_CATCH_UP_CONSUMERS[consumer];
  const value = env[name]?.trim() || "off";
  if (!(ZOHO_MIRROR_MODES as readonly string[]).includes(value)) {
    throw new Error(`${name} must be one of ${ZOHO_MIRROR_MODES.join(", ")}, not ${value}`);
  }
  return value as ZohoMirrorMode;
}
