import type { ClassifiedError, IErrorReporter } from "./interfaces/error-handling.js";

export class NoOpErrorReporter implements IErrorReporter {
  report(_classified: ClassifiedError): void {}
}
