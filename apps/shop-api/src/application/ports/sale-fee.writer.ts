export type ApproveSaleFeeCommand = {
  feeId: string;
  actorSubjectId: string;
};

export type SaleFeeWriter = {
  approveFee(command: ApproveSaleFeeCommand): Promise<{ feeId: string; status: "approved" }>;
};
