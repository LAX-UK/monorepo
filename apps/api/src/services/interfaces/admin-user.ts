export type AdminUserListFilter = {
  q?: string | undefined;
  limit: number;
  offset: number;
};

export type AdminUserListRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: Date;
  suspendedAt: Date | null;
};

export type AdminUserListResult = {
  rows: AdminUserListRow[];
  total: number;
};

export type AdminUserDetail = AdminUserListRow & {
  suspendedReason: string | null;
};

export type AdminActivityEntry = {
  id: string;
  createdAt: Date;
  expiresAt: Date;
  ipAddress: string | null;
};

export interface IAdminUserReader {
  list(filter: AdminUserListFilter): Promise<AdminUserListResult>;
  getById(id: string): Promise<AdminUserDetail | null>;
}

export interface IAdminUserRoleManager {
  setRole(actorRole: string, userId: string, role: string): Promise<void>;
}

export interface IAdminUserSuspender {
  suspend(userId: string, reason: string | null): Promise<void>;
  unsuspend(userId: string): Promise<void>;
}

export interface IAdminUserActivityReader {
  getRecentSessions(userId: string, limit: number): Promise<AdminActivityEntry[]>;
}
