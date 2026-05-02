import type { Env } from "../env.js";
import { type AppLogger, createAppLogger } from "../lib/logger.js";
import type { ClassifiedError, IErrorLogger } from "../services/interfaces/error-handling.js";

export class ConsoleErrorLogger implements IErrorLogger {
  private readonly appLog: AppLogger;

  constructor(env: Env) {
    this.appLog = createAppLogger(env);
  }

  log(classified: ClassifiedError): void {
    this.appLog.error(
      {
        message: classified.message,
        status: classified.status,
        code: classified.code,
        severity: classified.severity,
      },
      "http_error",
    );
  }
}
