import type { IProjectorCursorStart } from "../../repositories/drizzle-projector-cursor-start.js";
import type { AccountingProjection } from "./accounting-projection.service.js";
import type { AccountingSender } from "./accounting-sender.service.js";

/** What the accounting projector and sender run with; absent when Books is not configured. */
export interface AccountingRuntime {
  readonly projection: AccountingProjection;
  readonly sender: AccountingSender;
  readonly cursorStart: IProjectorCursorStart;
}
