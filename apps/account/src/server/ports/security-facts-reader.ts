import type { AccountSecurityFactsResponse } from "@auction/identity-contracts";

export type SecurityFactsReader = {
  /** The signed-in person's live facts, or null when the issuer could not answer. */
  read(accessToken: string): Promise<AccountSecurityFactsResponse | null>;
};
