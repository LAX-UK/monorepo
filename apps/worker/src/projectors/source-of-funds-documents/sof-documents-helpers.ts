export type DocumentsRequestedPayload = {
  sourceOfFundsId?: string;
  userId?: string;
  documentTypes?: string[];
  note?: string | null;
};

export type DocumentsSubmittedPayload = {
  sourceOfFundsId?: string;
  userId?: string;
  documentCount?: number;
};

export type ReviewedPayload = {
  sourceOfFundsId?: string;
  userId?: string;
  status?: string;
};
