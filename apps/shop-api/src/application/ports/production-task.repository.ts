import type {
  AdminProductionTaskDetail,
  AdminProductionTaskListItem,
  ProductionTaskStaff,
  ProductionTaskStatus,
} from "@auction/shop-contracts";
import type { CatalogueCursor } from "../catalogue-cursor.js";

export type ProductionTaskFilters = {
  status?: ProductionTaskStatus;
  /** `unassigned`, or the identity subject of the staff member the task is assigned to. */
  assignee?: { type: "unassigned" } | { type: "subject"; subject: string };
  /** Free text matched against the artwork title and the start of the order and task ids. */
  q?: string;
};

export type ListProductionTasksInput = {
  filters: ProductionTaskFilters;
  cursor: CatalogueCursor | null;
  limit: number;
};

export type ProductionTaskPage = {
  items: AdminProductionTaskListItem[];
  nextCursor: CatalogueCursor | null;
  /** Matches per status under every filter except `status`, so the chips add up. */
  counts: Record<string, number>;
};

export type UpdateProductionTaskInput = {
  id: string;
  expectedVersion: number;
  status?: ProductionTaskStatus;
  /** Null unassigns; undefined leaves the assignee alone. Already checked to be eligible staff. */
  assigneeSubject?: string | null;
  actorSubjectId: string;
  /** Asked once the row is locked and its version matched, so the answer cannot go stale. */
  canMove: (from: ProductionTaskStatus, to: ProductionTaskStatus) => boolean;
};

export type UpdateProductionTaskOutcome =
  | { status: "updated"; version: number; taskStatus: ProductionTaskStatus }
  | { status: "stale"; currentVersion: number }
  | { status: "not_allowed"; currentVersion: number; from: ProductionTaskStatus }
  | { status: "not_found" };

export interface ProductionTaskRepository {
  list(input: ListProductionTasksInput): Promise<ProductionTaskPage>;
  getDetail(id: string): Promise<AdminProductionTaskDetail | null>;
  /** Changes the task and writes its audit row in one transaction. */
  update(input: UpdateProductionTaskInput): Promise<UpdateProductionTaskOutcome>;
  /** Active staff who hold `production.write`. */
  listAssignees(): Promise<ProductionTaskStaff[]>;
}
