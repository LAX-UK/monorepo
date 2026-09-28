export type CrmModule = "Leads" | "Contacts" | "Deals";

export type CrmFieldValue = string | number | boolean | null | { id: string };

export type CrmRecordAction = "insert" | "update" | "upsert" | "delete" | "convert";

export type CrmRecordResult = {
  module: CrmModule;
  recordId: string;
  action: CrmRecordAction;
  code?: string;
  status: "success" | "error";
  message?: string;
};

export type CrmUpsertInput = {
  module: CrmModule;
  fields: Record<string, CrmFieldValue>;
  duplicateCheckFields: string[];
};

export type CrmUpdateByIdInput = {
  module: CrmModule;
  recordId: string;
  fields: Record<string, CrmFieldValue>;
};

export type CrmSearchByEmailInput = {
  module: "Leads" | "Contacts";
  email: string;
};

export type CrmSearchByEmailResult = {
  recordId: string;
  module: "Leads" | "Contacts";
} | null;

export type CrmConvertLeadInput = {
  leadId: string;
  contactFields?: Record<string, CrmFieldValue>;
};

export type CrmConvertLeadResult = {
  contactId: string;
};

export type CrmDeleteRecordInput = {
  module: CrmModule;
  recordId: string;
};

export type CrmDeleteRecordResult =
  | { status: "deleted" }
  | { status: "already_deleted" }
  | { status: "error"; code: string; message?: string };

export type CrmBatchUpsertInput = {
  module: CrmModule;
  records: Record<string, CrmFieldValue>[];
  duplicateCheckFields: string[];
};

export type CrmGatewayMetrics = {
  apiCreditsRemaining: number | null;
};

/** Narrow port for outbound Zoho CRM writes (real adapter + fake for tests). */
export interface CrmGateway {
  upsert(input: CrmUpsertInput): Promise<CrmRecordResult>;
  upsertMany(input: CrmBatchUpsertInput): Promise<CrmRecordResult[]>;
  updateById(input: CrmUpdateByIdInput): Promise<CrmRecordResult>;
  findByEmail(input: CrmSearchByEmailInput): Promise<CrmSearchByEmailResult>;
  findDealIdsByContact(contactId: string): Promise<string[]>;
  executeCoql(selectQuery: string): Promise<string[]>;
  convertLead(input: CrmConvertLeadInput): Promise<CrmConvertLeadResult>;
  deleteRecord(input: CrmDeleteRecordInput): Promise<CrmDeleteRecordResult>;
  purgeFromRecycleBin(recordId: string): Promise<void>;
  getMetrics(): CrmGatewayMetrics;
}
