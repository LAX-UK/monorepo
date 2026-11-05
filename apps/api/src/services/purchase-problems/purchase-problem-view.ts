import { purchaseProblemNextStatuses, purchaseProblemReference } from "@auction/domain";
import type {
  PurchaseProblemDeskRecord,
  PurchaseProblemNoteRecord,
} from "@auction/persistence/interfaces";
import type {
  PurchaseProblemListItem,
  PurchaseProblemView,
} from "../interfaces/purchase-problem-desk-service.js";

export function toListItem(record: PurchaseProblemDeskRecord): PurchaseProblemListItem {
  return {
    id: record.id,
    reference: purchaseProblemReference(record.id),
    status: record.status,
    category: record.category,
    buyerName: record.buyer.name,
    lot: record.lot,
    raisedAt: record.createdAt.toISOString(),
    assignedToUserId: record.assignedToUserId,
  };
}

export function toView(
  record: PurchaseProblemDeskRecord,
  notes: readonly PurchaseProblemNoteRecord[],
): PurchaseProblemView {
  return {
    ...toListItem(record),
    message: record.message,
    version: record.version,
    payment: record.payment,
    resolvedAt: record.resolvedAt?.toISOString() ?? null,
    resolvedByUserId: record.resolvedByUserId,
    nextStatuses: [...purchaseProblemNextStatuses(record.status)],
    notes: notes.map((note) => ({
      id: note.id,
      authorUserId: note.authorUserId,
      body: note.body,
      createdAt: note.createdAt.toISOString(),
    })),
  };
}
