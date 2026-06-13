export interface IPlatformFeePolicy {
  /** Platform fee in major currency units (e.g. "12.50") for a seller entity and gross total. */
  computePlatformFee(sellerLegalEntityId: string, totalDueMajor: number): Promise<string>;
  /** Platform fee from integer pence total (avoids float drift). */
  computePlatformFeeFromPence(sellerLegalEntityId: string, totalDuePence: number): Promise<string>;
}
