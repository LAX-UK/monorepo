export type AdminCommandBeginInput = {
  commandType: string;
  idempotencyKey: string;
  requestHash: string;
  actorSubjectId: string;
};

export type AdminCommandBeginResult =
  | { kind: "started" }
  | { kind: "replay"; result: unknown }
  | { kind: "conflict" };

export type ShopAdminCommandWriter = {
  begin(input: AdminCommandBeginInput): Promise<AdminCommandBeginResult>;
  complete(input: {
    commandType: string;
    actorSubjectId: string;
    idempotencyKey: string;
    result: unknown;
  }): Promise<void>;
};
