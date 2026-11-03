import type { DataRequestProduct } from "@auction/identity-contracts";
import type { subjectDataRequest } from "@auction/identity-db/schema";
import type { ManualRequestRow } from "../services/data-request.ports.js";

type Record_ = typeof subjectDataRequest.$inferSelect;

export function toManualRequestRow(row: Record_): ManualRequestRow {
  return {
    id: row.id,
    reference: row.reference,
    subjectId: row.subjectId,
    contactName: row.contactName,
    contactDetail: row.contactDetail,
    contactClearedAt: row.contactClearedAt,
    reason: row.reason as ManualRequestRow["reason"],
    channel: row.channel as ManualRequestRow["channel"],
    products: row.products as DataRequestProduct[],
    productGathered: (row.productGathered ?? {}) as ManualRequestRow["productGathered"],
    receivedOn: row.receivedOn,
    clockStartedOn: row.clockStartedOn,
    dueOn: row.dueOn,
    extendedDueOn: row.extendedDueOn,
    extensionReason: row.extensionReason,
    extensionNote: row.extensionNote,
    personToldOn: row.personToldOn,
    personToldVia: row.personToldVia,
    status: row.status as ManualRequestRow["status"],
    outcome: row.outcome as ManualRequestRow["outcome"],
    outcomeNote: row.outcomeNote,
    complaintRightTold: row.complaintRightTold,
    closedOn: row.closedOn,
    closedBy: row.closedBy,
    linkedExportId: row.linkedExportId,
    notes: row.notes,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    version: row.version,
  };
}
