export type AuctionInterestsSettingsActionState = {
  error: string | null;
  redirectTo: string | null;
  savedCategoryIds: string[] | null;
};

export const INITIAL_AUCTION_INTERESTS_SETTINGS_ACTION_STATE: AuctionInterestsSettingsActionState =
  {
    error: null,
    redirectTo: null,
    savedCategoryIds: null,
  };
