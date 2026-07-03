export type SourceOfFundsRequiredPayload = {
  sourceOfFundsId?: string;
  userId?: string;
  trigger?: string;
  thresholdAmount?: string;
  exposureAmount?: string;
  currency?: string;
  reopened?: boolean;
};
