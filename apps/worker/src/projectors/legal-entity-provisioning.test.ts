import { describe, expect, it, vi } from "vitest";
import type { EnsurePersonalLegalEntityService } from "../services/ensure-personal-legal-entity.service.js";
import { applyUserRegisteredEvent } from "./legal-entity-provisioning.js";

describe("applyUserRegisteredEvent", () => {
  it("calls ensure with payload fields", async () => {
    const ensure = vi.fn().mockResolvedValue({ legalEntityId: "le-1", created: true });
    const service = { ensure } as unknown as EnsurePersonalLegalEntityService;
    const log = { warn: vi.fn() } as unknown as import("pino").Logger;

    await applyUserRegisteredEvent(
      service,
      {
        id: 1,
        payload: { userId: "u-1", email: "a@example.com", name: "Alice" },
      },
      log,
    );

    expect(ensure).toHaveBeenCalledWith({
      userId: "u-1",
      displayName: "Alice",
      email: "a@example.com",
    });
  });

  it("skips malformed payloads without calling ensure", async () => {
    const ensure = vi.fn();
    const service = { ensure } as unknown as EnsurePersonalLegalEntityService;
    const warn = vi.fn();
    const log = { warn } as unknown as import("pino").Logger;

    await applyUserRegisteredEvent(service, { id: 2, payload: { name: "Alice" } }, log);

    expect(ensure).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      { eventId: 2 },
      "legal_entity_provisioning_skipped_malformed_payload",
    );
  });
});
