import { ZodError } from "zod";
import type {
  ClassifiedError,
  IErrorResponseBuilder,
} from "../services/interfaces/error-handling.js";

export class JsonErrorResponseBuilder implements IErrorResponseBuilder {
  build(classified: ClassifiedError): Response {
    const body: Record<string, unknown> = { error: classified.message };
    if (classified.cause instanceof ZodError) {
      body.details = classified.cause.flatten();
    }
    return Response.json(body, { status: classified.status });
  }
}
