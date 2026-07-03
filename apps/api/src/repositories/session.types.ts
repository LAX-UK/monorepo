export type AuthSessionListRow = {
  id: string;
  token: string;
  createdAt: Date;
  expiresAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  lastPasswordAuthAt: Date | null;
};
