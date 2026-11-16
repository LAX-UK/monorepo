import type { FoundAccountStatus } from "@auction/types";

/** The account states the account search returns, in the words staff read. */
export const FOUND_ACCOUNT_STATUS_LABELS: Readonly<Record<FoundAccountStatus, string>> = {
  active: "Active",
  disabled: "Disabled",
};
