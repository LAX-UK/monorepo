import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { ShopDomainError } from "@auction/shop-domain";
import type { FastifyInstance } from "fastify";
import { InvalidCatalogueCursorError } from "../application/catalogue-cursor.js";
import { ShopApiError } from "../errors/shop-api-error.js";

function isValidationError(error: unknown): error is { validation: unknown } {
  return typeof error === "object" && error !== null && "validation" in error;
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ShopApiError) {
      request.log.warn(
        { code: error.code, statusCode: error.statusCode, msg: error.message },
        "shop_api_client_error",
      );
      return reply.status(error.statusCode).send({
        code: error.code,
        message: error.message,
        requestId: request.id,
      });
    }
    if (error instanceof ShopDomainError) {
      const message = error instanceof Error ? error.message : "Request conflict";
      request.log.warn(
        { code: SHOP_API_ERROR_CODES.CONFLICT, statusCode: 409, msg: message },
        "shop_api_client_error",
      );
      return reply.status(409).send({
        code: SHOP_API_ERROR_CODES.CONFLICT,
        message,
        requestId: request.id,
      });
    }
    if (error instanceof InvalidCatalogueCursorError) {
      return reply.status(400).send({
        code: SHOP_API_ERROR_CODES.VALIDATION,
        message: error.message,
        requestId: request.id,
      });
    }
    if (isValidationError(error) && error.validation) {
      return reply.status(400).send({
        code: SHOP_API_ERROR_CODES.VALIDATION,
        message: "Request validation failed",
        requestId: request.id,
      });
    }
    request.log.error({ err: error }, "shop_api_unhandled_error");
    return reply.status(500).send({
      code: SHOP_API_ERROR_CODES.INTERNAL,
      message: "Internal server error",
      requestId: request.id,
    });
  });
}
