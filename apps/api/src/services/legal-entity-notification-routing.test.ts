import { describe, expect, it, vi } from "vitest";
import type { ILegalEntityNotificationRecipientReader } from "./interfaces/legal-entity-notification-recipients.js";
import { legalEntityNotificationAudienceRoles } from "./interfaces/legal-entity-notification-recipients.js";
import { resolveLegalEntityNotificationRecipients } from "./legal-entity-notification-routing.js";

describe("legal entity notification routing", () => {
  it("defines role audiences for seller, finance, and admin notifications", () => {
    expect(legalEntityNotificationAudienceRoles.seller).toEqual(["owner", "admin", "consignor"]);
    expect(legalEntityNotificationAudienceRoles.finance).toEqual(["owner", "admin", "finance"]);
    expect(legalEntityNotificationAudienceRoles.admin).toEqual(["owner", "admin"]);
  });

  it("dedupes legal entity recipients", async () => {
    const reader: ILegalEntityNotificationRecipientReader = {
      listUserIdsForAudience: vi.fn().mockResolvedValue(["u1", "u2", "u1"]),
    };

    await expect(
      resolveLegalEntityNotificationRecipients(reader, {
        legalEntityId: "le-1",
        fallbackUserId: "legacy",
        audience: "seller",
      }),
    ).resolves.toEqual(["u1", "u2"]);
  });

  it("falls back to the legacy user when no legal entity recipient is available", async () => {
    const reader: ILegalEntityNotificationRecipientReader = {
      listUserIdsForAudience: vi.fn().mockResolvedValue([]),
    };

    await expect(
      resolveLegalEntityNotificationRecipients(reader, {
        legalEntityId: "le-1",
        fallbackUserId: "legacy",
        audience: "finance",
      }),
    ).resolves.toEqual(["legacy"]);
  });
});
