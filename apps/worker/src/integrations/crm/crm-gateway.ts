export type CrmModule = "Leads" | "Contacts" | "Deals" | "Products" | "Arts" | "Notes" | "Tasks";

/** A lookup value; `module` names the parent module of a Note. */
export type CrmLookupValue = { id: string; module?: { api_name: string } };

export type CrmFieldValue = string | number | boolean | null | CrmLookupValue;

export type CrmRecordAction = "insert" | "update" | "upsert" | "delete";

export type CrmRecordResult = {
  module: CrmModule;
  recordId: string;
  action: CrmRecordAction;
  code?: string;
  status: "success" | "error";
  message?: string;
  /** Zoho `details.api_name` when a field-level validation fails. */
  fieldApiName?: string;
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

export type CrmLeadSummary = {
  status: string | null;
  ownerId: string | null;
  /** The Contact created by converting the lead; null while it is not converted. */
  convertedContactId: string | null;
};

export type CrmCreateInput = {
  module: CrmModule;
  fields: Record<string, CrmFieldValue>;
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

/** Updates to many records of one module in one request; each record carries its `id`. */
export type CrmBatchUpdateInput = {
  module: CrmModule;
  records: ({ id: string } & Record<string, CrmFieldValue>)[];
};

export type CrmGatewayMetrics = {
  apiCreditsRemaining: number | null;
};

/** One page of rows from a COQL select. */
export type CrmCoqlPage = {
  rows: Record<string, unknown>[];
  /** True when Zoho has more rows beyond this page. */
  moreRecords: boolean;
};

/** Narrow port for reading rows with a COQL select (separate from the write gateway). */
export interface CrmCoqlQuery {
  queryCoql(selectQuery: string): Promise<CrmCoqlPage>;
}

/**
 * Narrow port for updating many records in one request. Zoho answers per record, in the order
 * sent, so one refused record never fails the others.
 */
export interface CrmBatchUpdate {
  updateMany(input: CrmBatchUpdateInput): Promise<CrmRecordResult[]>;
}

/** Narrow port for outbound Zoho CRM writes (real adapter + fake for tests). */
export interface CrmGateway {
  upsert(input: CrmUpsertInput): Promise<CrmRecordResult>;
  upsertMany(input: CrmBatchUpsertInput): Promise<CrmRecordResult[]>;
  updateById(input: CrmUpdateByIdInput): Promise<CrmRecordResult>;
  findByEmail(input: CrmSearchByEmailInput): Promise<CrmSearchByEmailResult>;
  findDealIdsByContact(contactId: string): Promise<string[]>;
  executeCoql(selectQuery: string): Promise<string[]>;
  /** Inserts one record (a Note or Task); there is nothing to match it against. */
  createRecord(input: CrmCreateInput): Promise<CrmRecordResult>;
  /** Reads a lead's status, owner and, once an admin converted it, the new Contact. */
  findLead(leadId: string): Promise<CrmLeadSummary | null>;
  deleteRecord(input: CrmDeleteRecordInput): Promise<CrmDeleteRecordResult>;
  purgeFromRecycleBin(recordId: string): Promise<void>;
  getMetrics(): CrmGatewayMetrics;
}
