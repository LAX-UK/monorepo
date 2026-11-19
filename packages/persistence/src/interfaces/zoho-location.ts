import type { LocationRef } from "@auction/artwork-register-contracts";

/** What the Zoho `LAX_Location` mirror needs of an original: its Product and where it is now. */
export type RegisterLocationSource = {
  registerId: string;
  stockCode: string;
  zohoProductId: string;
  /** The latest move's location; null when no location has been recorded. */
  location: LocationRef | null;
};

/** Reads the register and the stock location moves for the Zoho `LAX_Location` mirror. */
export interface IZohoLocationSourceReader {
  /** The sources for these records, originals only (they are the Zoho Products), in id order. */
  read(registerIds: readonly string[]): Promise<RegisterLocationSource[]>;
}
