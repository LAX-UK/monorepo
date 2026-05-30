export type LotBidEntryMode = "auto" | "manual";

export function defaultLotBidEntryMode(opts: {
  supportsAutoBid: boolean;
  hasActiveAutoBid: boolean;
  userPreference: LotBidEntryMode | null;
}): LotBidEntryMode {
  if (!opts.supportsAutoBid) return "manual";
  if (opts.userPreference) return opts.userPreference;
  if (opts.hasActiveAutoBid) return "auto";
  return "auto";
}
