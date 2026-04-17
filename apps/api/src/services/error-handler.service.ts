import type { Context } from "hono";
import type {
  ClassifiedError,
  IErrorClassifier,
  IErrorLogger,
  IErrorReporter,
  IErrorResponseBuilder,
  IHttpErrorHandler,
} from "./interfaces/error-handling.js";

export class ErrorHandlerService implements IHttpErrorHandler {
  constructor(
    private readonly classifier: IErrorClassifier,
    private readonly logger: IErrorLogger,
    private readonly reporter: IErrorReporter,
    private readonly responseBuilder: IErrorResponseBuilder,
  ) {}

  handle(error: unknown, _c: Context): Response {
    const classified = this.classifier.classify(error);
    this.logger.log(classified);
    if (classified.severity === "error") {
      this.reporter.report(classified);
    }
    return this.responseBuilder.build(classified);
  }
}
