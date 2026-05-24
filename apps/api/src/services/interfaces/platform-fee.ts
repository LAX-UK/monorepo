export interface IPlatformFeePolicy {
  /** Platform fee in major currency units (e.g. "12.50") for a seller entity and gross total. */
  computePlatformFee(sellerLegalEntityId: string, totalDueMajor: number): Promise<string>;
}
