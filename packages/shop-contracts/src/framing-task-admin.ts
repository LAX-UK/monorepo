import { type Static, Type } from "@sinclair/typebox";

/** Moves the work on a frame sold with a print to its next step. */
export const FRAMING_TASK_STATUS_VALUES = [
  "queued",
  "framing",
  "framed",
  "completed",
  "cancelled",
] as const;

export const FramingTaskStatusSchema = Type.Unsafe<(typeof FRAMING_TASK_STATUS_VALUES)[number]>(
  Type.Union(FRAMING_TASK_STATUS_VALUES.map((value) => Type.Literal(value))),
);

export const FramingTaskParamsSchema = Type.Object({ taskId: Type.String({ format: "uuid" }) });

export const FramingTaskUpdateBodySchema = Type.Object({
  status: FramingTaskStatusSchema,
  /** The task's version when it was opened; a newer change by someone else is refused. */
  expectedVersion: Type.Integer({ minimum: 1 }),
});
export type FramingTaskUpdateBody = Static<typeof FramingTaskUpdateBodySchema>;

export const FramingTaskSchema = Type.Object({
  taskId: Type.String({ format: "uuid" }),
  orderLineId: Type.String({ format: "uuid" }),
  status: FramingTaskStatusSchema,
  dueAt: Type.String({ format: "date-time" }),
  version: Type.Integer({ minimum: 1 }),
});
export type FramingTask = Static<typeof FramingTaskSchema>;
