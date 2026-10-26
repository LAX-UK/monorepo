import { type Static, Type } from "@sinclair/typebox";

/**
 * Mirrors the `shop_production_task_status` enum. The allowed moves between them live in
 * `@auction/shop-domain` (`production-task-state.ts`); shop-api checks the two lists agree.
 */
export const PRODUCTION_TASK_STATUSES = [
  "queued",
  "printing",
  "qc_pending",
  "qc_failed",
  "qc_passed",
  "completed",
  "cancelled",
] as const;
export type ProductionTaskStatus = (typeof PRODUCTION_TASK_STATUSES)[number];

export const PRODUCTION_TASK_SEARCH_MAX_LENGTH = 100;
export const PRODUCTION_TASK_LIST_MAX_LIMIT = 100;

const NullableString = Type.Union([Type.String(), Type.Null()]);

export const ProductionTaskStatusSchema = Type.Union(
  PRODUCTION_TASK_STATUSES.map((status) => Type.Literal(status)),
);

/** A staff member as shown on a task. `label` is null when they have no profile. */
export const ProductionTaskStaffSchema = Type.Object({
  subject: Type.String(),
  label: NullableString,
  role: NullableString,
});
export type ProductionTaskStaff = Static<typeof ProductionTaskStaffSchema>;

/** Newest first by default; the task id breaks ties either way. */
export const PRODUCTION_TASK_SORTS = ["created_desc", "created_asc"] as const;
export type ProductionTaskSort = (typeof PRODUCTION_TASK_SORTS)[number];

/** `assignee` is `me`, `unassigned` or a staff identity subject. */
export const AdminProductionTaskListQuerySchema = Type.Object({
  sort: Type.Optional(Type.Union([Type.Literal("created_desc"), Type.Literal("created_asc")])),
  status: Type.Optional(ProductionTaskStatusSchema),
  assignee: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
  q: Type.Optional(Type.String({ maxLength: PRODUCTION_TASK_SEARCH_MAX_LENGTH })),
  cursor: Type.Optional(Type.String({ maxLength: 512 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: PRODUCTION_TASK_LIST_MAX_LIMIT })),
});
export type AdminProductionTaskListQuery = Static<typeof AdminProductionTaskListQuerySchema>;

export const AdminProductionTaskListItemSchema = Type.Object({
  taskId: Type.String({ format: "uuid" }),
  orderId: Type.String({ format: "uuid" }),
  /** The order's reference, "LAX-S-10482"; optional for responses from an older shop-api. */
  orderReference: Type.Optional(Type.String()),
  orderLineId: Type.String({ format: "uuid" }),
  editionId: Type.String({ format: "uuid" }),
  artworkTitle: NullableString,
  editionNumber: Type.Union([Type.Integer(), Type.Null()]),
  status: ProductionTaskStatusSchema,
  assignee: Type.Union([ProductionTaskStaffSchema, Type.Null()]),
  /** Send back as `expectedVersion` when changing the task. */
  version: Type.Integer(),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});
export type AdminProductionTaskListItem = Static<typeof AdminProductionTaskListItemSchema>;

export const AdminProductionTaskListSchema = Type.Object({
  items: Type.Array(AdminProductionTaskListItemSchema),
  nextCursor: NullableString,
  /** Matches per status under every active filter except `status`, so the chips add up. */
  counts: Type.Record(Type.String(), Type.Integer()),
});
export type AdminProductionTaskList = Static<typeof AdminProductionTaskListSchema>;

export const AdminProductionTaskParamsSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
});

/** At least one of `status` and `assigneeSubject`; null unassigns. */
export const AdminProductionTaskUpdateBodySchema = Type.Object(
  {
    expectedVersion: Type.Integer({ minimum: 1 }),
    status: Type.Optional(ProductionTaskStatusSchema),
    assigneeSubject: Type.Optional(
      Type.Union([Type.String({ minLength: 1, maxLength: 200 }), Type.Null()]),
    ),
  },
  { additionalProperties: false },
);
export type AdminProductionTaskUpdateBody = Static<typeof AdminProductionTaskUpdateBodySchema>;

export const AdminProductionTaskUpdateResponseSchema = Type.Object({
  version: Type.Integer(),
  status: ProductionTaskStatusSchema,
});
export type AdminProductionTaskUpdateResponse = Static<
  typeof AdminProductionTaskUpdateResponseSchema
>;

/** 409: the task changed since `expectedVersion`, or the status move is not allowed. */
export const AdminProductionTaskConflictBodySchema = Type.Object({
  code: Type.String(),
  message: Type.String(),
  requestId: Type.Optional(Type.String()),
  currentVersion: Type.Integer(),
});

const ChangeSchema = <T extends ReturnType<typeof Type.Union> | ReturnType<typeof Type.Object>>(
  value: T,
) => Type.Object({ from: value, to: value });

export const AdminProductionTaskHistoryEntrySchema = Type.Object({
  id: Type.String({ format: "uuid" }),
  at: Type.String(),
  actor: ProductionTaskStaffSchema,
  kind: Type.Union([Type.Literal("created"), Type.Literal("updated")]),
  /** Present when the entry changed the status. */
  status: Type.Union([ChangeSchema(ProductionTaskStatusSchema), Type.Null()]),
  /** Present when the entry changed the assignee. */
  assignee: Type.Union([
    ChangeSchema(Type.Union([ProductionTaskStaffSchema, Type.Null()])),
    Type.Null(),
  ]),
});
export type AdminProductionTaskHistoryEntry = Static<typeof AdminProductionTaskHistoryEntrySchema>;

export const AdminProductionTaskDetailSchema = Type.Composite([
  AdminProductionTaskListItemSchema,
  Type.Object({ history: Type.Array(AdminProductionTaskHistoryEntrySchema) }),
]);
export type AdminProductionTaskDetail = Static<typeof AdminProductionTaskDetailSchema>;

/** Active staff who can work on production tasks, for the assignee picker. */
export const AdminProductionAssigneesResponseSchema = Type.Object({
  items: Type.Array(ProductionTaskStaffSchema),
});
export type AdminProductionAssigneesResponse = Static<
  typeof AdminProductionAssigneesResponseSchema
>;
