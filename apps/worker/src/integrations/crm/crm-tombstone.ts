/** Placeholder ids for subjects erased before any Zoho link existed. */
export const CRM_TOMBSTONE_MODULE = "__tombstone__";
export const CRM_TOMBSTONE_RECORD_ID = "__none__";

export function isTombstoneLink(zohoModule: string, zohoRecordId: string): boolean {
  return zohoModule === CRM_TOMBSTONE_MODULE || zohoRecordId === CRM_TOMBSTONE_RECORD_ID;
}

export function isRealZohoLink(zohoModule: string, zohoRecordId: string): boolean {
  return !isTombstoneLink(zohoModule, zohoRecordId);
}
