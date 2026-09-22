import { vi } from "vitest";
import type { ShopIdentityTokenService } from "../application/shop-identity-token.service.js";

export function createTestTokenService(
  overrides: Partial<ShopIdentityTokenService> = {},
): ShopIdentityTokenService {
  return {
    resolveIdToken: vi.fn(async () => "resolved-id-token"),
    persist: vi.fn(async () => undefined),
    clear: vi.fn(async () => undefined),
    hasStoredRefreshToken: vi.fn(async () => true),
    readIdTokenForLogout: vi.fn(async () => "logout-id-token"),
    ...overrides,
  };
}
