import type { INotificationAccountMuteStore } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { NotificationAccountMuteService } from "./notification-account-mute.service.js";

function store(memberOf: string[] = ["org-north"]): INotificationAccountMuteStore {
  return {
    listMutedAccountIds: vi.fn(async () => []),
    listForUser: vi.fn(async () => [
      {
        legalEntityId: "org-north",
        displayName: "Northbank Gallery",
        mutedAt: new Date("2026-10-30T09:00:00Z"),
      },
    ]),
    isMemberOfOrganisation: vi.fn(async (_u: string, id: string) => memberOf.includes(id)),
    mute: vi.fn(async () => {}),
    unmute: vi.fn(async () => true),
  };
}

describe("NotificationAccountMuteService", () => {
  it("mutes an organisation the person belongs to", async () => {
    const s = store();
    const result = await new NotificationAccountMuteService(s).mute("ada", "org-north");
    expect(result.isOk()).toBe(true);
    expect(s.mute).toHaveBeenCalledWith("ada", "org-north");
  });

  it("refuses an organisation the person does not belong to, or a personal account", async () => {
    const s = store([]);
    const result = await new NotificationAccountMuteService(s).mute("ada", "personal-ada");
    expect(result._unsafeUnwrapErr()).toMatchObject({
      code: "not_an_organisation_member",
      status: 404,
    });
    expect(s.mute).not.toHaveBeenCalled();
  });

  it("always lets a person unmute, also after leaving", async () => {
    const s = store([]);
    await new NotificationAccountMuteService(s).unmute("ada", "org-north");
    expect(s.unmute).toHaveBeenCalledWith("ada", "org-north");
  });

  it("lists mutes with the organisation's name", async () => {
    expect(await new NotificationAccountMuteService(store()).list("ada")).toEqual([
      {
        legalEntityId: "org-north",
        displayName: "Northbank Gallery",
        mutedAt: "2026-10-30T09:00:00.000Z",
      },
    ]);
  });
});
