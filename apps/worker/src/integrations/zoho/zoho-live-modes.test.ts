import { describe, expect, it } from "vitest";
import type { WorkerEnv } from "../../env.js";
import { resolveZohoDeliveryMode } from "./zoho-crm-config.js";
import {
  type ZohoModes,
  actsOnZohoCrm,
  writesToZohoCrm,
  zohoCrmNeedsSandboxOrg,
} from "./zoho-live-modes.js";

const OTHERS_OFF = {
  ZOHO_ARTWORK_SYNC_MODE: "off",
  ZOHO_ARTWORK_WRITEBACK_MODE: "off",
  ZOHO_ARTWORK_LISTING_MODE: "off",
  ZOHO_ARTWORK_LOCATION_MODE: "off",
  ZOHO_FULFILMENT_MIRROR_MODE: "off",
  ZOHO_QC_READY_MODE: "off",
} as const;

function modes(crm: ZohoModes["ZOHO_CRM_SYNC_MODE"], appEnv: ZohoModes["APP_ENV"]): ZohoModes {
  return { APP_ENV: appEnv, ZOHO_CRM_SYNC_MODE: crm, ...OTHERS_OFF };
}

/** `canary` is documented as `live` under another name; these pin that it stays so. */
describe("ZOHO_CRM_SYNC_MODE canary", () => {
  it.each(["production", "test", "development"] as const)(
    "counts exactly as live for writes, org checks and the sandbox rule (APP_ENV=%s)",
    (appEnv) => {
      const canary = modes("canary", appEnv);
      const live = modes("live", appEnv);
      expect(writesToZohoCrm(canary)).toBe(writesToZohoCrm(live));
      expect(actsOnZohoCrm(canary)).toBe(actsOnZohoCrm(live));
      expect(zohoCrmNeedsSandboxOrg(canary)).toBe(zohoCrmNeedsSandboxOrg(live));
      expect(writesToZohoCrm(canary)).toBe(true);
    },
  );

  it("is held to the same allowlist as live", () => {
    const allowlist = { ZOHO_CRM_ENABLED_EVENT_TYPES: "user.registered" };
    const canary = { ...allowlist, ZOHO_CRM_SYNC_MODE: "canary" } as WorkerEnv;
    const live = { ...allowlist, ZOHO_CRM_SYNC_MODE: "live" } as WorkerEnv;
    expect(resolveZohoDeliveryMode(canary, "user.registered")).toBe("canary");
    expect(resolveZohoDeliveryMode(live, "user.registered")).toBe("live");
    expect(resolveZohoDeliveryMode(canary, "bid.lot_won")).toBe("disabled_type");
    expect(resolveZohoDeliveryMode(live, "bid.lot_won")).toBe("disabled_type");
  });
});
