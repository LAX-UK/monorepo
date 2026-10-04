export type ShopAdminAuditRecord = {
  actorSubjectId: string;
  capability: string;
  action: string;
  targetType: string;
  targetId: string;
  afterJson?: Record<string, unknown>;
  beforeJson?: Record<string, unknown>;
  requestId?: string;
};

export type ShopAdminAuditWriter = {
  append(record: ShopAdminAuditRecord): Promise<void>;
};
