export type MarkPayoutPaidCommand = {
  payoutId: string;
  paidReference: string;
  actorSubjectId: string;
};

export type PayoutWriter = {
  markPaid(command: MarkPayoutPaidCommand): Promise<{ payoutId: string; status: "paid" }>;
};
