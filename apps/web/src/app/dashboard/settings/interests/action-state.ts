export type AuctionInterestsSettingsActionState = {
  error: string | null;
  redirectTo: string | null;
  diagnostic: {
    stage: "request" | "response" | "parse" | "unknown";
    status: number | null;
    apiCode: string | null;
    errorName: string;
    errorMessage: string;
    selectedCount: number;
  } | null;
};

export const INITIAL_AUCTION_INTERESTS_SETTINGS_ACTION_STATE: AuctionInterestsSettingsActionState =
  {
    error: null,
    redirectTo: null,
    diagnostic: null,
  };
