import type { IRegisterLotIntegrityReader } from "@auction/persistence/interfaces";
import type { Logger } from "pino";

/** Enough to start investigating from the log; the staff inbox lists every one. */
const SAMPLE_SIZE = 20;
const SCAN_LIMIT = 500;

/**
 * The nightly check for artworks the register places in a LAX Bid sale whose lot is not live.
 * Staff see each one in their inbox as "Register says this artwork is in a LAX Bid sale, but the
 * lot isn't live"; the item goes when the register and the lot agree again. Nothing is changed
 * here: staff decide whether the artwork should be released or the lot restored. A warning is
 * logged when any are found, so the night's result is also on record.
 */
export async function checkRegisterLotIntegrity(input: {
  reader: IRegisterLotIntegrityReader;
  log: Logger;
}): Promise<{ found: number }> {
  const mismatches = await input.reader.listBidSaleMismatches(SCAN_LIMIT);
  if (mismatches.length > 0) {
    input.log.warn(
      {
        found: mismatches.length,
        sample: mismatches.slice(0, SAMPLE_SIZE).map((row) => ({
          registerId: row.registerId,
          stockCode: row.stockCode,
          lotId: row.lotId,
          lotStatus: row.lotStatus,
        })),
      },
      "register_lot_mismatch_found",
    );
  } else {
    input.log.info({ found: 0 }, "register_lot_integrity_clean");
  }
  return { found: mismatches.length };
}
