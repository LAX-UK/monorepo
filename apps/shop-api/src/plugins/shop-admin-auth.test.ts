import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import type { FastifyRequest } from "fastify";
import { describe, expect, it } from "vitest";
import { ShopApiError } from "../errors/shop-api-error.js";
import { requireRecentFinanceAuthentication } from "./shop-admin-auth.js";

describe("requireRecentFinanceAuthentication", () => {
  it("rejects missing auth_time", () => {
    const request = {
      shopAdminAuth: {
        subject: "sub-1",
        scopes: ["shop.admin"],
        role: "finance" as const,
        authTime: undefined,
      },
    } as unknown as FastifyRequest;
    expect(() => requireRecentFinanceAuthentication(request, 900)).toThrow(ShopApiError);
    try {
      requireRecentFinanceAuthentication(request, 900);
    } catch (err) {
      expect(err).toBeInstanceOf(ShopApiError);
      expect((err as ShopApiError).code).toBe(SHOP_API_ERROR_CODES.STEP_UP_REQUIRED);
    }
  });

  it("accepts recent auth_time", () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const request = {
      shopAdminAuth: {
        subject: "sub-1",
        scopes: ["shop.admin"],
        role: "finance" as const,
        authTime: nowSec - 60,
      },
    } as unknown as FastifyRequest;
    expect(() => requireRecentFinanceAuthentication(request, 900)).not.toThrow();
  });
});
