export type AdminPaddleRosterEntry = {
  paddleNumber: number;
  userId: string;
  displayName: string;
  bidLimit: string | null;
  hasActiveSelfServiceSession: boolean;
};
