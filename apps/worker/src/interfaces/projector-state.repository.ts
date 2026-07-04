import type { ProjectorDbConnection } from "./worker-db.types.js";

export interface IProjectorStateRepository {
  ensureCursor(projectorName: string, conn?: ProjectorDbConnection): Promise<void>;
  getCursor(projectorName: string, conn?: ProjectorDbConnection): Promise<number>;
  advanceCursor(projectorName: string, maxId: number, conn?: ProjectorDbConnection): Promise<void>;
  advanceCursorLiteralName(
    projectorName: string,
    maxId: number,
    conn?: ProjectorDbConnection,
  ): Promise<void>;
  recordError(
    projectorName: string,
    lastError: string,
    conn?: ProjectorDbConnection,
  ): Promise<void>;
}
