export type ZohoCrmSyncMode = "off" | "dry_run" | "canary" | "live";

export type ZohoCrmModule = "Contacts" | "Deals" | "Sales_Orders";

export type ZohoUpsertRecord = {
  module: ZohoCrmModule;
  externalId: string;
  fields: Record<string, string | number | boolean | null>;
};

export type ZohoUpsertResult = {
  module: ZohoCrmModule;
  externalId: string;
  zohoRecordId?: string;
  status: number;
};

export class ZohoCrmHttpError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(status: number, body: string) {
    super(`zoho_crm_http_${status}`);
    this.name = "ZohoCrmHttpError";
    this.status = status;
    this.body = body;
  }
}

export class ZohoCrmAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZohoCrmAuthError";
  }
}
