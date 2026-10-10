import { describe, expect, it, vi } from "vitest";
import type { ContainerCredentialSetupSlice } from "../../container/container-slices.js";
import { IdentityIssuerClientError } from "../../infrastructure/http-identity-issuer.client.js";
import { setupCredentialPassword } from "./credential-setup.service.js";

function containerRejecting(code: string): ContainerCredentialSetupSlice {
  return {
    identityIssuer: {
      setupPassword: vi
        .fn()
        .mockRejectedValue(new IdentityIssuerClientError("http", "rejected", 400, code)),
    } as unknown as ContainerCredentialSetupSlice["identityIssuer"],
  };
}

describe("setupCredentialPassword", () => {
  it.each(["invalid_password_policy", "password_breached"] as const)(
    "surfaces %s instead of a generic failure",
    async (code) => {
      await expect(
        setupCredentialPassword({
          container: containerRejecting(code),
          userId: "subject",
          password: "Correct-horse-9",
        }),
      ).resolves.toEqual({ ok: false, kind: code });
    },
  );

  it("keeps unexpected issuer errors generic", async () => {
    await expect(
      setupCredentialPassword({
        container: containerRejecting("something_else"),
        userId: "subject",
        password: "Correct-horse-9",
      }),
    ).resolves.toEqual({ ok: false, kind: "db_error" });
  });
});
