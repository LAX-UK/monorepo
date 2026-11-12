import type {
  IImpersonationSessionRepository,
  ImpersonationSessionRow,
} from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { ImpersonationSessionService } from "./impersonation-session.service.js";

const ENTITY = "11111111-1111-4111-8111-111111111111";

function setup(row: Partial<ImpersonationSessionRow>) {
  const end = vi.fn().mockResolvedValue(undefined);
  const repo = {
    findById: vi.fn().mockResolvedValue({
      id: "s1",
      actorUserId: "a",
      targetLegalEntityId: ENTITY,
      endedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      ...row,
    }),
    end,
  } as unknown as IImpersonationSessionRepository;
  return { service: new ImpersonationSessionService(repo), end };
}

const input = { sessionId: "s1", actorUserId: "a", targetLegalEntityId: ENTITY };

describe("ImpersonationSessionService.validateForRequest", () => {
  it("accepts a live session of the actor", async () => {
    const { service } = setup({});
    expect(await service.validateForRequest(input)).toMatchObject({ ok: true });
  });

  it("reports an expired session without ending it, so the audit owner ends and records it once", async () => {
    const { service, end } = setup({ expiresAt: new Date(Date.now() - 1000) });
    expect(await service.validateForRequest(input)).toEqual({ ok: false, reason: "expired" });
    expect(end).not.toHaveBeenCalled();
  });
});
