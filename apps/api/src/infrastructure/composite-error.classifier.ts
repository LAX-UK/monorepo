import type { ClassifiedError, IErrorClassifier } from "../services/interfaces/error-handling.js";
import { tryClassifyDomainValidation } from "./domain-validation-error.classifier.js";
import { classifyGenericFallback } from "./generic-fallback-error.classifier.js";
import { tryClassifyPostgres } from "./postgres-error.classifier.js";

/**
 * Ordered chain: domain HTTP errors, validation, Postgres drift/FK, then generic 500.
 * Add new links by extending this class or adding optional constructor-injected links (OCP).
 */
export class CompositeErrorClassifier implements IErrorClassifier {
  classify(error: unknown): ClassifiedError {
    return (
      tryClassifyDomainValidation(error) ??
      tryClassifyPostgres(error) ??
      classifyGenericFallback(error)
    );
  }
}
