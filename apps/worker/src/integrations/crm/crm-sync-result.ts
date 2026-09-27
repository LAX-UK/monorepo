export type CrmSyncResult =
  | { outcome: "success"; providerReference: string }
  | { outcome: "skipped"; reason: string }
  | { outcome: "retry"; error: unknown }
  | { outcome: "fatal"; error: unknown };
